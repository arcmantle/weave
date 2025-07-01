# ESPlot

⚠️ **Experimental** - This project is experimental and not feature complete, but the base functionality works.

ESPlot is a data visualization library that combines TypeScript/Node.js chart creation with a native desktop viewer. It allows you to programmatically generate charts using a simple API and display them in a dedicated viewer application.

## How It Works

ESPlot consists of two main components:

1. **Core Library (TypeScript/Node.js)**: Provides functions for creating charts (bar charts, word clouds, etc.) using Chart.js
2. **Viewer (Go)**: A native desktop application that displays the generated charts in real-time

The workflow is:

1. Your TypeScript/Node.js code calls chart functions like `barChart()`
2. The library bundles the chart code using Vite
3. The bundled code is sent to the viewer via HTTP
4. The viewer displays the chart in a native window
5. Multiple charts can be viewed with tabs

## Setup

### Quick Start

The easiest way to use ESPlot is to add it as a dependency to your project. The pre-built viewer binaries are included in the package, so you can start creating charts immediately:

```bash
npm install jsr:@arcmantle/esplot
# or
pnpm add jsr:@arcmantle/esplot
# or
yarn add jsr:@arcmantle/esplot
```

Then you can directly start creating charts:

```typescript
import { barChart } from '@arcmantle/esplot';

await barChart(
  { year: 2020, count: 10 },
  { year: 2021, count: 20 },
  { year: 2022, count: 15 }
);
```

### Development Setup

If you want to build from source or contribute to the project:

#### Prerequisites

- Node.js with TypeScript support (or Bun/Deno)
- Go (latest version recommended)

##### Building the Viewer

```bash
# Navigate to the viewer directory
cd viewer

# For Windows
go build -o ../core/bin/esplotv-win32.exe -ldflags="-H windowsgui" .

# For macOS
go build -o ../core/bin/esplotv-arm64 .
```

#### Running Charts

```bash
# Build the TypeScript library
npm run build

# Run the demo
node demo/index.ts
# or with Bun/Deno
bun run demo/index.ts
deno run demo/index.ts
```

## Usage

```typescript
import { barChart } from '@arcmantle/esplot';

// Create a bar chart
await barChart(
  { year: 2020, count: 10 },
  { year: 2021, count: 20 },
  { year: 2022, count: 15 }
);
```

The chart will automatically open in the ESPlot viewer window.

## Features

- Real-time chart display in native desktop window
- Multiple chart support with tabbed interface
- Built on Chart.js for rich visualization capabilities
- TypeScript support with simple API
- Cross-platform (Windows and macOS)

## Current Chart Types

- Bar charts
- Word clouds (experimental)
