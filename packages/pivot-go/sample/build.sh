#!/bin/bash

set -e

echo "Building Sample Pivot Application..."

# Create directories
mkdir -p bin
mkdir -p plugins

# Build coordinator
echo "Building sample coordinator..."
go build -o bin/coordinator ./coordinator

# Build proxy
echo "Building sample proxy..."
go build -o bin/proxy ./proxy

# Build server
echo "Building sample server..."
go build -o bin/server ./server

# Build plugins
echo "Building users plugin..."
go build -buildmode=plugin -o plugins/users.so ./plugins/users-plugin

echo ""
echo "Build complete!"
echo ""
echo "Binaries created:"
echo "  - bin/coordinator"
echo "  - bin/proxy"
echo "  - bin/server"
echo "  - plugins/users.so"
echo ""
echo "To run the sample application:"
echo "  1. Terminal 1: ./bin/coordinator"
echo "  2. Terminal 2: ./bin/proxy"
echo "  3. Access http://localhost:5000"
echo ""
echo "Try these endpoints:"
echo "  - http://localhost:5000/           (Welcome message)"
echo "  - http://localhost:5000/api/users  (List users from plugin)"
echo "  - http://localhost:5000/api/stats  (Plugin statistics)"
