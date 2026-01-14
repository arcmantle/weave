module github.com/arcmantle/weave/packages/pivot-go/sample

go 1.21

replace github.com/arcmantle/weave/packages/pivot-go => ../

require (
	github.com/arcmantle/weave/packages/pivot-go v0.0.0
	github.com/fsnotify/fsnotify v1.7.0
	github.com/gorilla/mux v1.8.1
)

require golang.org/x/sys v0.13.0 // indirect
