package web

import (
	"embed"
	"io/fs"
)

//go:embed dist/*
var embeddedDist embed.FS

func EmbeddedDist() (fs.FS, error) {
	return fs.Sub(embeddedDist, "dist")
}
