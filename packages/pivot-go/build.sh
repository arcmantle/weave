#!/bin/bash

set -e

echo "Building Pivot Go components..."

# Create directories
mkdir -p bin
mkdir -p plugins

# Build coordinator
echo "Building coordinator..."
go build -o bin/coordinator ./coordinator

# Build proxy
echo "Building proxy..."
go build -o bin/proxy ./proxy

# Build server
echo "Building server..."
go build -o bin/server ./server

# Build example plugin
echo "Building example plugin..."
go build -buildmode=plugin -o plugins/hello.so ./examples/hello-plugin

echo "Build complete!"
echo ""
echo "Binaries created:"
echo "  - bin/coordinator"
echo "  - bin/proxy"
echo "  - bin/server"
echo "  - plugins/hello.so"
echo ""
echo "To run:"
echo "  1. ./bin/coordinator"
echo "  2. ./bin/proxy (in another terminal)"
echo "  3. Access http://localhost:5000"
