package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/arcmantle/weave/apps/food-guru/server/internal/app"
)

func buildIngredientTestMux(repository app.Repository) *http.ServeMux {
	mux := http.NewServeMux()
	mux.Handle("POST /api/ingredients", handleAddIngredient(repository))
	mux.Handle("PUT /api/ingredients/{id}", handleUpdateIngredient(repository))
	mux.Handle("GET /api/state", handleGetState(repository))

	return mux
}

func doJSONRequest(t *testing.T, handler http.Handler, method string, path string, payload any) *httptest.ResponseRecorder {
	t.Helper()

	var body *bytes.Reader
	if payload == nil {
		body = bytes.NewReader(nil)
	} else {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("failed encoding request payload: %v", err)
		}
		body = bytes.NewReader(encoded)
	}

	request := httptest.NewRequest(method, path, body)
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	return response
}

func decodeResponseBody[T any](t *testing.T, response *httptest.ResponseRecorder) T {
	t.Helper()

	var decoded T
	if err := json.Unmarshal(response.Body.Bytes(), &decoded); err != nil {
		t.Fatalf("failed decoding response: %v\nbody: %s", err, response.Body.String())
	}

	return decoded
}

func findIngredientByID(state app.FoodGuruState, ingredientID string) *app.IngredientItem {
	for index := range state.Ingredients {
		ingredient := &state.Ingredients[index]
		if ingredient.ID == ingredientID {
			return ingredient
		}
	}

	return nil
}

func TestUpdateIngredientEndpointPersistsUpdatedFields(t *testing.T) {
	repository := app.NewInMemoryRepository()
	if err := repository.Init(context.Background()); err != nil {
		t.Fatalf("failed to initialize repository: %v", err)
	}

	mux := buildIngredientTestMux(repository)

	addResponse := doJSONRequest(t, mux, http.MethodPost, "/api/ingredients", map[string]any{
		"name":     "Greek Yogurt",
		"quantity": "normal",
		"notes":    "Old notes",
		"tags":     []string{"dairy"},
	})
	if addResponse.Code != http.StatusCreated {
		t.Fatalf("expected add status %d, got %d: %s", http.StatusCreated, addResponse.Code, addResponse.Body.String())
	}

	createdIngredient := decodeResponseBody[app.IngredientItem](t, addResponse)
	if createdIngredient.Quantity != "normal" {
		t.Fatalf("expected initial quantity normal, got %q", createdIngredient.Quantity)
	}

	updateResponse := doJSONRequest(t, mux, http.MethodPut, "/api/ingredients/"+createdIngredient.ID, map[string]any{
		"name":     "Skyr Yogurt",
		"notes":    "High protein",
		"tags":     []string{"dairy", "breakfast"},
		"imageUrl": "https://example.test/skyr.png",
		"nutrients": []map[string]any{
			{
				"key":    "protein",
				"value":  "19",
				"unit":   "g",
				"pinned": true,
			},
		},
	})
	if updateResponse.Code != http.StatusOK {
		t.Fatalf("expected update status %d, got %d: %s", http.StatusOK, updateResponse.Code, updateResponse.Body.String())
	}

	updatedIngredient := decodeResponseBody[app.IngredientItem](t, updateResponse)
	if updatedIngredient.Name != "Skyr Yogurt" {
		t.Fatalf("expected updated name, got %q", updatedIngredient.Name)
	}
	if updatedIngredient.Notes != "High protein" {
		t.Fatalf("expected updated notes, got %q", updatedIngredient.Notes)
	}
	if updatedIngredient.Quantity != "normal" {
		t.Fatalf("expected quantity to remain normal when omitted from payload, got %q", updatedIngredient.Quantity)
	}
	if updatedIngredient.ImageURL != "https://example.test/skyr.png" {
		t.Fatalf("expected updated image url, got %q", updatedIngredient.ImageURL)
	}
	if len(updatedIngredient.Tags) != 2 || updatedIngredient.Tags[0] != "dairy" || updatedIngredient.Tags[1] != "breakfast" {
		t.Fatalf("unexpected tags after update: %#v", updatedIngredient.Tags)
	}
	if len(updatedIngredient.Nutrients) != 1 {
		t.Fatalf("expected 1 nutrient, got %d", len(updatedIngredient.Nutrients))
	}
	if updatedIngredient.Nutrients[0].Key != "protein" || updatedIngredient.Nutrients[0].Value != "19" || updatedIngredient.Nutrients[0].Unit != "g" || !updatedIngredient.Nutrients[0].Pinned {
		t.Fatalf("unexpected nutrient after update: %#v", updatedIngredient.Nutrients[0])
	}

	stateResponse := doJSONRequest(t, mux, http.MethodGet, "/api/state", nil)
	if stateResponse.Code != http.StatusOK {
		t.Fatalf("expected state status %d, got %d: %s", http.StatusOK, stateResponse.Code, stateResponse.Body.String())
	}

	state := decodeResponseBody[app.FoodGuruState](t, stateResponse)
	persistedIngredient := findIngredientByID(state, createdIngredient.ID)
	if persistedIngredient == nil {
		t.Fatalf("expected ingredient %q in state", createdIngredient.ID)
	}
	if persistedIngredient.Name != "Skyr Yogurt" || persistedIngredient.Notes != "High protein" {
		t.Fatalf("persisted ingredient not updated as expected: %#v", *persistedIngredient)
	}

	quantityUpdateResponse := doJSONRequest(t, mux, http.MethodPut, "/api/ingredients/"+createdIngredient.ID, map[string]any{
		"quantity": "2 tubs",
	})
	if quantityUpdateResponse.Code != http.StatusOK {
		t.Fatalf("expected quantity update status %d, got %d: %s", http.StatusOK, quantityUpdateResponse.Code, quantityUpdateResponse.Body.String())
	}

	quantityUpdatedIngredient := decodeResponseBody[app.IngredientItem](t, quantityUpdateResponse)
	if quantityUpdatedIngredient.Quantity != "2 tubs" {
		t.Fatalf("expected quantity to update to %q, got %q", "2 tubs", quantityUpdatedIngredient.Quantity)
	}
}
