# Pivot.Registry.Tests

End-to-end tests for the Pivot Registry using Microsoft.Playwright for .NET.

## Prerequisites

Install Playwright browsers (one-time setup):

```bash
pwsh bin/Debug/net10.0/playwright.ps1 install
```

Or on Unix-like systems:
```bash
./bin/Debug/net10.0/playwright.sh install
```

## Running Tests

The tests automatically start and stop the server, so just run:

```bash
dotnet test
```

Run tests with detailed output:

```bash
dotnet test --logger "console;verbosity=detailed"
```

## Test Coverage

The authentication test suite verifies:

- ✅ Redirect to login when not authenticated
- ✅ Login with username and JWT token issuance
- ✅ Username display in sidebar
- ✅ Logout functionality
- ✅ Authentication persistence across page reloads
- ✅ Empty username validation
- ✅ Enter key support for login
- ✅ Route protection after logout
- ✅ HTTP-only cookie validation

## Architecture

- **Test Framework**: xUnit
- **Browser Automation**: Microsoft.Playwright
- **Target**: Blazor WebAssembly with .NET backend
- **Base URL**: http://localhost:5000
