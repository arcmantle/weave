# ESPlot Viewer

A real-time plot viewer application built in Go with WebView integration, designed to display dynamic plots and charts through WebSocket connections.

## Overview

ESPlot Viewer is a desktop application that provides a graphical interface for viewing plots in real-time. It combines a Go backend with a WebView frontend to create a responsive plotting environment that can receive and display new plot data via WebSocket connections.

## Features

- **Real-time Plot Display**: Receive and display plots instantly through WebSocket connections
- **Multi-plot Support**: Handle multiple plots with tabbed navigation
- **Cross-platform**: Built with Go for Windows and macOS compatibility
- **WebView Integration**: Native desktop application with web-based rendering
- **HTTP API**: REST endpoint for submitting new plot data
- **Live Updates**: Automatic refresh when new plot data arrives

## Architecture

The application consists of several key components:

### Backend (Go)

- **Main Server** (`main.go`): HTTP server and WebView window management
- **WebSocket Hub** (`hub.go`): Manages client connections and message broadcasting
- **Client Handler** (`client.go`): Handles individual WebSocket connections
- **Static Assets**: Embedded web interface served from `wwwroot/`

### Frontend (Web)

- **HTML Interface** (`wwwroot/index.html`): Web-based UI with plot display capabilities
- **WebSocket Client**: Real-time communication with the Go backend
- **Dynamic Tabs**: Navigation between multiple plots

## API Endpoints

### WebSocket Connection

- **Endpoint**: `ws://localhost:46852/ws`
- **Purpose**: Real-time bidirectional communication for plot updates

### HTTP Endpoints

- **GET** `/`: Serves the main web interface
- **POST** `/new`: Submit new plot HTML content
  - Accepts HTML content in request body
  - Broadcasts to all connected WebSocket clients

## Building

### Windows

```bash
go build -o ../core/bin/esplotv-win32.exe -ldflags="-H windowsgui" .
```

### macOS

```bash
go build -o ../core/bin/esplotv-arm64 .
```

## Usage

1. **Start the Application**

   ```bash
   ./esplotv-win32.exe  # Windows
   ./esplotv-arm64      # macOS
   ```

2. **Submit Plot Data**

   ```bash
   curl -X POST http://localhost:46852/new \
        -H "Content-Type: text/html" \
        -d "<html>Your plot HTML content here</html>"
   ```

3. **View Plots**

   - The application window will automatically display new plots
   - Multiple plots are accessible via timestamp-labeled tabs
   - Click tabs to switch between different plots

## Dependencies

- **Go 1.23.2+**
- **github.com/gorilla/websocket**: WebSocket implementation
- **github.com/webview/webview_go**: Cross-platform WebView bindings

## Configuration

- **Server Port**: `46852` (hardcoded)
- **Window Size**: 800x600 pixels (configurable in `main.go`)
- **WebSocket Settings**: Configurable timeouts and buffer sizes in `client.go`

## Development

The application embeds the `wwwroot/` directory at build time, so any changes to the web interface require a rebuild. The WebSocket hub is based on the Gorilla WebSocket chat example and provides reliable message broadcasting to connected clients.

### Project Structure

```text
viewer/
├── main.go           # Application entry point and HTTP server
├── hub.go            # WebSocket hub for client management
├── client.go         # WebSocket client connection handling
├── go.mod            # Go module dependencies
├── wwwroot/
│   └── index.html    # Web interface
└── README.md         # This file
```

## Notes

- The application runs a local HTTP server on port 46852
- WebView window management is platform-specific
- Plot data should be provided as complete HTML documents
- The interface supports dynamic script execution for interactive plots
