package main

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/arcmantle/forge/helpers"
)

var levels = []struct {
	label string
	color string
}{
	{"info", helpers.ColorCyan},
	{"debug", helpers.ColorGray},
	{"warn", helpers.ColorYellow},
	{"error", helpers.ColorRed},
	{"trace", helpers.ColorMagenta},
}

var components = []string{
	"http.server", "db.pool", "cache.redis", "auth.jwt",
	"queue.worker", "storage.s3", "api.gateway", "rpc.grpc",
	"metrics.prom", "ws.handler", "cron.scheduler", "mail.smtp",
}

var messages = []string{
	"processing request",
	"connection established",
	"query executed in %dms",
	"cache miss for key %s",
	"retrying operation (attempt %d/3)",
	"health check passed",
	"shutting down gracefully",
	"starting worker pool (%d goroutines)",
	"compiling template %s",
	"rate limit exceeded for %s",
	"certificate expires in %d days",
	"migrating schema to version %d",
	"rebalancing partitions",
	"snapshot saved (%d bytes)",
	"index rebuilt in %dms",
	"websocket upgrade for client %s",
	"draining queue (%d pending)",
	"gc pause %dms",
	"accepted connection from %s:%d",
	"resolved dependency %s@%s",
}

var words = []string{
	"alpha", "bravo", "charlie", "delta", "echo",
	"foxtrot", "golf", "hotel", "india", "juliet",
}

var versions = []string{"1.0.0", "2.3.1", "0.9.4", "3.1.0", "1.2.7"}

func main() {
	helpers.Info("stress-test: generating 1000 lines of simulated output")
	fmt.Println()

	r := rand.New(rand.NewSource(time.Now().UnixNano()))

	for i := 1; i <= 1000; i++ {
		lvl := levels[r.Intn(len(levels))]
		comp := components[r.Intn(len(components))]
		msg := messages[r.Intn(len(messages))]

		// Fill format verbs with random values.
		msg = fillFormats(r, msg)

		ts := fmt.Sprintf("%02d:%02d:%02d.%03d",
			r.Intn(24), r.Intn(60), r.Intn(60), r.Intn(1000))

		line := fmt.Sprintf("%s%s\033[0m \033[90m%s\033[0m [%s%-5s\033[0m] \033[1m%s\033[0m  %s",
			helpers.ColorGray, ts, comp, lvl.color, lvl.label, lvl.color, msg)

		// Occasionally add a bold highlight or dim detail.
		if r.Intn(4) == 0 {
			detail := fmt.Sprintf("  \033[2m(request_id=%s-%04d)\033[0m",
				words[r.Intn(len(words))], r.Intn(10000))
			line += detail
		}

		fmt.Println(line)

		// Occasional multi-line stack trace (roughly every ~50 lines).
		if r.Intn(50) == 0 {
			printStackTrace(r, comp)
		}

		// Small delay to simulate streaming output.
		time.Sleep(time.Duration(r.Intn(3)) * time.Millisecond)
	}

	fmt.Println()
	helpers.Success("stress-test complete: 1000 lines emitted")
}

func fillFormats(r *rand.Rand, msg string) string {
	for strings.Contains(msg, "%d") {
		msg = strings.Replace(msg, "%d", fmt.Sprintf("%d", r.Intn(9999)+1), 1)
	}
	for strings.Contains(msg, "%s") {
		if r.Intn(2) == 0 {
			msg = strings.Replace(msg, "%s", words[r.Intn(len(words))], 1)
		} else {
			msg = strings.Replace(msg, "%s", versions[r.Intn(len(versions))], 1)
		}
	}
	return msg
}

func printStackTrace(r *rand.Rand, comp string) {
	frames := []string{
		"  at Server.handleRequest (server.go:142)",
		"  at Router.dispatch (router.go:87)",
		"  at Middleware.execute (middleware.go:34)",
		"  at Pool.acquire (pool.go:201)",
		"  at Connection.query (conn.go:156)",
		"  at Cache.get (cache.go:73)",
	}
	count := 3 + r.Intn(3)
	fmt.Printf("\033[31m  └─ stack trace (%s):\033[0m\n", comp)
	for j := 0; j < count && j < len(frames); j++ {
		fmt.Printf("\033[90m%s\033[0m\n", frames[j])
	}
}
