package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/arcmantle/weave/apps/food-guru/server/internal/app"
	"github.com/arcmantle/weave/apps/food-guru/server/internal/update"
	"github.com/arcmantle/weave/apps/food-guru/server/internal/web"
	_ "modernc.org/sqlite"
)

var appVersion = "0.0.0"

type browserCandidate struct {
	bin  string
	args []string
}

func main() {
	assetsDir := flag.String("assets", "", "optional path to built client assets")
	host := flag.String("host", "127.0.0.1", "HTTP host")
	port := flag.Int("port", 8787, "HTTP port")
	dataDir := flag.String("data-dir", "", "optional data directory for sqlite and app files")
	openBrowser := flag.Bool("open-browser", true, "open app window in browser on startup")
	updateManifestURL := flag.String("update-manifest-url", "", "optional update manifest URL")
	flag.Parse()

	if strings.TrimSpace(*updateManifestURL) == "" {
		*updateManifestURL = strings.TrimSpace(os.Getenv("FOOD_GURU_UPDATE_MANIFEST_URL"))
	}

	assetsFS := resolveAssetsFS(*assetsDir)
	repository := mustCreateRepository(*dataDir)
	updater := update.NewService(*updateManifestURL, appVersion)
	listener := mustListen(*host, *port)

	mux := http.NewServeMux()
	mux.Handle("GET /api/state", handleGetState(repository))
	mux.Handle("POST /api/meals", handleAddMeal(repository))
	mux.Handle("POST /api/meals/{id}/toggle", handleToggleMeal(repository))
	mux.Handle("POST /api/ingredients", handleAddIngredient(repository))
	mux.Handle("POST /api/ingredients/{id}/toggle", handleToggleIngredient(repository))
	mux.Handle("PUT /api/settings", handleUpdateSettings(repository))
	mux.Handle("GET /api/update", handleUpdateStatus(updater))
	mux.Handle("POST /api/update/apply", handleApplyUpdate(updater))
	mux.Handle("/", spaFileServer(assetsFS))

	server := &http.Server{
		Handler: mux,
	}

	url := fmt.Sprintf("http://%s", listener.Addr().String())
	log.Printf("Food Guru listening on %s", url)
	if *openBrowser {
		openAppWindow(url)
	}

	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func mustCreateRepository(dataDir string) app.Repository {
	dbPath, err := resolveDatabasePath(dataDir)
	if err != nil {
		log.Fatalf("failed resolving data directory: %v", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("failed opening sqlite database: %v", err)
	}

	if _, err := db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		log.Fatalf("failed enabling sqlite wal mode: %v", err)
	}

	repository := app.NewSQLiteRepository(db)
	if err := repository.Init(context.Background()); err != nil {
		log.Fatalf("failed initializing sqlite schema: %v", err)
	}

	log.Printf("using sqlite database %s", dbPath)

	return repository
}

func resolveDatabasePath(flagDataDir string) (string, error) {
	basePath := strings.TrimSpace(flagDataDir)
	if basePath == "" {
		basePath = strings.TrimSpace(os.Getenv("FOOD_GURU_DATA_DIR"))
	}

	if basePath == "" {
		configDir, err := os.UserConfigDir()
		if err == nil {
			basePath = filepath.Join(configDir, "food-guru")
		} else {
			basePath = filepath.Join(os.TempDir(), "food-guru")
		}
	}

	if err := os.MkdirAll(basePath, 0o755); err != nil {
		return "", err
	}

	return filepath.Join(basePath, "food-guru.db"), nil
}

func handleGetState(repository app.Repository) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := tenantIDFromRequest(r)
		state, err := repository.GetState(r.Context(), tenantID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}

		writeJSON(w, http.StatusOK, state)
	})
}

func handleAddMeal(repository app.Repository) http.Handler {
	type request struct {
		Day      string `json:"day"`
		Name     string `json:"name"`
		Calories int    `json:"calories"`
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body request
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}

		if strings.TrimSpace(body.Day) == "" || strings.TrimSpace(body.Name) == "" || body.Calories <= 0 {
			writeError(w, http.StatusBadRequest, fmt.Errorf("invalid meal payload"))
			return
		}

		tenantID := tenantIDFromRequest(r)
		meal, err := repository.AddMeal(r.Context(), tenantID, app.AddMealInput{
			Day:      body.Day,
			Name:     body.Name,
			Calories: body.Calories,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}

		writeJSON(w, http.StatusCreated, meal)
	})
}

func handleToggleMeal(repository app.Repository) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mealID := strings.TrimSpace(r.PathValue("id"))
		if mealID == "" {
			writeError(w, http.StatusBadRequest, fmt.Errorf("missing meal id"))
			return
		}

		tenantID := tenantIDFromRequest(r)
		meal, err := repository.ToggleMealComplete(r.Context(), tenantID, mealID)
		if err != nil {
			if err == app.ErrNotFound {
				writeError(w, http.StatusNotFound, err)
				return
			}

			writeError(w, http.StatusInternalServerError, err)
			return
		}

		writeJSON(w, http.StatusOK, meal)
	})
}

func handleAddIngredient(repository app.Repository) http.Handler {
	type request struct {
		Name     string `json:"name"`
		Quantity string `json:"quantity"`
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body request
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}

		if strings.TrimSpace(body.Name) == "" || strings.TrimSpace(body.Quantity) == "" {
			writeError(w, http.StatusBadRequest, fmt.Errorf("invalid ingredient payload"))
			return
		}

		tenantID := tenantIDFromRequest(r)
		ingredient, err := repository.AddIngredient(r.Context(), tenantID, app.AddIngredientInput{
			Name:     body.Name,
			Quantity: body.Quantity,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}

		writeJSON(w, http.StatusCreated, ingredient)
	})
}

func handleToggleIngredient(repository app.Repository) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ingredientID := strings.TrimSpace(r.PathValue("id"))
		if ingredientID == "" {
			writeError(w, http.StatusBadRequest, fmt.Errorf("missing ingredient id"))
			return
		}

		tenantID := tenantIDFromRequest(r)
		ingredient, err := repository.ToggleIngredientStock(r.Context(), tenantID, ingredientID)
		if err != nil {
			if err == app.ErrNotFound {
				writeError(w, http.StatusNotFound, err)
				return
			}

			writeError(w, http.StatusInternalServerError, err)
			return
		}

		writeJSON(w, http.StatusOK, ingredient)
	})
}

func handleUpdateSettings(repository app.Repository) http.Handler {
	type request struct {
		DailyCalorieGoal   int  `json:"dailyCalorieGoal"`
		ShowCompletedMeals bool `json:"showCompletedMeals"`
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body request
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}

		if body.DailyCalorieGoal <= 0 {
			writeError(w, http.StatusBadRequest, fmt.Errorf("dailyCalorieGoal must be greater than 0"))
			return
		}

		tenantID := tenantIDFromRequest(r)
		settings, err := repository.UpdateSettings(r.Context(), tenantID, app.Settings{
			DailyCalorieGoal:   body.DailyCalorieGoal,
			ShowCompletedMeals: body.ShowCompletedMeals,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}

		writeJSON(w, http.StatusOK, settings)
	})
}

func handleUpdateStatus(updater *update.Service) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		status, err := updater.Check(r.Context())
		if err != nil {
			writeJSON(w, http.StatusOK, status)
			return
		}

		writeJSON(w, http.StatusOK, status)
	})
}

func handleApplyUpdate(updater *update.Service) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		status, err := updater.Apply(r.Context())
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}

		writeJSON(w, http.StatusAccepted, status)

		go func() {
			time.Sleep(750 * time.Millisecond)
			os.Exit(0)
		}()
	})
}

func tenantIDFromRequest(request *http.Request) string {
	tenantID := strings.TrimSpace(request.Header.Get("X-Tenant-ID"))
	if tenantID != "" {
		return tenantID
	}

	tenantID = strings.TrimSpace(request.URL.Query().Get("tenant"))
	if tenantID != "" {
		return tenantID
	}

	return app.DefaultTenantID
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{
		"error": err.Error(),
	})
}

func resolveAssetsFS(assetsDir string) fs.FS {
	if assetsDir != "" {
		dirFS := os.DirFS(assetsDir)
		if _, err := fs.Stat(dirFS, "index.html"); err == nil {
			return dirFS
		}
		log.Printf("assets path %q does not contain index.html, using embedded fallback", assetsDir)
	}

	embedded, err := web.EmbeddedDist()
	if err != nil {
		log.Fatalf("failed to load embedded assets: %v", err)
	}

	return embedded
}

func spaFileServer(assetsFS fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(assetsFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Clean(r.URL.Path)
		if path == "." || path == "/" {
			fileServer.ServeHTTP(w, r)
			return
		}

		trimmed := path
		if len(trimmed) > 0 && trimmed[0] == '/' {
			trimmed = trimmed[1:]
		}

		if _, err := fs.Stat(assetsFS, trimmed); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}

		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}

func mustListen(host string, port int) net.Listener {
	addr := fmt.Sprintf("%s:%d", host, port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen on %s: %v", addr, err)
	}

	return listener
}

func openAppWindow(url string) {
	for _, candidate := range browserCandidates(url) {
		path, err := exec.LookPath(candidate.bin)
		if err != nil {
			if !filepath.IsAbs(candidate.bin) {
				continue
			}
			if _, statErr := os.Stat(candidate.bin); statErr != nil {
				continue
			}
			path = candidate.bin
		}

		cmd := exec.Command(path, candidate.args...)
		if cmd.Start() == nil {
			return
		}
	}

	openBrowserFallback(url)
}

func browserCandidates(url string) []browserCandidate {
	dataDir := filepath.Join(os.TempDir(), "food-guru-browser-profile")

	switch runtime.GOOS {
	case "windows":
		return []browserCandidate{
			{bin: "msedge", args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
			{bin: `C:\Program Files\Microsoft\Edge\Application\msedge.exe`, args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
			{bin: `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
			{bin: "chrome", args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
			{bin: `C:\Program Files\Google\Chrome\Application\chrome.exe`, args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
			{bin: `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`, args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
		}
	case "darwin":
		return []browserCandidate{
			{bin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
			{bin: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
			{bin: "open", args: []string{"-a", "Safari", url}},
		}
	default:
		return []browserCandidate{
			{bin: "microsoft-edge", args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
			{bin: "google-chrome", args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
			{bin: "google-chrome-stable", args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
			{bin: "chromium", args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
			{bin: "chromium-browser", args: []string{"--app=" + url, "--window-size=1280,900", "--user-data-dir=" + dataDir}},
		}
	}
}

func openBrowserFallback(url string) {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}

	_ = cmd.Start()
}
