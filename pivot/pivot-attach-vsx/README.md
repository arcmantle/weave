# Pivot Auto-Attach Debugger

Automatically attaches the VS Code debugger to new Pivot backend Server.dll processes.

## Installation

### From Source

1. Navigate to the extension directory:

   ```bash
   cd apps/handover/auto-attach-vsx
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile the extension:

   ```bash
   npm run compile
   ```

4. Package the extension (optional):

   ```bash
   pnpx @vscode/vsce package
   ```

   This creates a `.vsix` file.

5. Install in VS Code:
   - **Option A**: Press `F5` in VS Code while in the extension directory to launch a new Extension Development Host window
   - **Option B**: Install the packaged `.vsix` file via `Extensions: Install from VSIX...` command in VS Code
   - **Option C**: Copy the extension folder to your VS Code extensions directory:
     - Windows: `%USERPROFILE%\.vscode\extensions\`
     - macOS/Linux: `~/.vscode/extensions/`

## Features

- Monitors for new `dotnet.exe` processes running `Server.dll`
- Automatically attaches the debugger when found
- Configurable symbol search paths for plugin debugging
- Can be enabled/disabled via commands

## Usage

1. After installing the extension, it will automatically start monitoring when enabled
2. Start your Pivot system (Coordinator + Proxy) using the "🔥 Full System with Hot Reload (Debug)" launch configuration
3. The extension automatically detects and attaches to new backend processes
4. Set breakpoints in your plugin code and they'll work immediately
5. When you make changes and hot reload triggers, the extension will detach from the old process and attach to the new one

## Configuration

Add to your `.vscode/settings.json`:

```json
{
  "pivotAutoAttach.enabled": true,
  "pivotAutoAttach.processName": "Server.dll",
  "pivotAutoAttach.symbolSearchPaths": [
    "${workspaceFolder}/server/Pivot.Coordinator/bin/Debug/net9.0/Deployments",
    "${workspaceFolder}/server/Plugins/**/bin/Debug/net9.0"
  ]
}
```

### Settings

- `pivotAutoAttach.enabled`: Enable/disable auto-attach (default: true)
- `pivotAutoAttach.processName`: DLL name to watch for (default: "Server.dll")
- `pivotAutoAttach.symbolSearchPaths`: Additional paths to search for symbols (supports wildcards)

## Commands

- `Pivot: Enable Auto-Attach to Backend` - Start monitoring
- `Pivot: Disable Auto-Attach to Backend` - Stop monitoring
