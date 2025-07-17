# @arcmantle/image-viewer

A high-performance image viewer web component built with web workers and offscreen canvas for smooth image manipulation and display.

## Features

- **🚀 High Performance**: Uses web workers and OffscreenCanvas for non-blocking image operations
- **🎯 Interactive Navigation**: Pan, zoom, and rotate images with mouse and touch support
- **📱 Touch Gestures**: Multi-touch zoom and pan support for mobile devices
- **⚡ Hardware Accelerated**: Leverages GPU acceleration through canvas rendering
- **🎨 Smooth Animations**: Frame-rate limited interactions for optimal performance
- **🔧 Programmatic API**: Full control through JavaScript API

## Installation

```bash
npm install @arcmantle/image-viewer

pnpm add @arcmantle/image-viewer

yarn add @arcmantle/image-viewer
```

## Usage

### Basic HTML Usage

```html
<iv-image-viewer
  image-src="/path/to/your/image.jpg"
  reset-on-new-image
  fit-on-new-image
></iv-image-viewer>
```

### JavaScript/TypeScript Usage

```typescript
import { ImageViewer } from '@arcmantle/image-viewer';

// Using the component
const viewer = document.createElement('iv-image-viewer');
viewer.imageSrc = '/path/to/image.jpg';
viewer.resetOnNewImage = true;
document.body.appendChild(viewer);

// Programmatic control
viewer.adapter.api.zoom(1.5);
viewer.adapter.api.rotate(90);
viewer.adapter.api.fitToView();
viewer.adapter.api.reset();
```

### React/JSX Usage

```tsx
import { ImageViewer } from '@arcmantle/image-viewer';

function App() {
  return (
    <ImageViewer
      image-src="/spiral.jpg"
      reset-on-new-image
      fit-on-new-image
    />
  );
}
```

## Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `imageSrc` | `string` | `''` | URL or path to the image to display |
| `resetOnNewImage` | `boolean` | `false` | Whether to reset view transformations when a new image is loaded |
| `fitOnNewImage` | `boolean` | `false` | Whether to automatically fit the image to view when loaded |

## API Methods

The component exposes an API object with the following methods:

```typescript
// Access the API
const api = imageViewer.adapter.api;

// Reset view to default state
api.reset();

// Fit image to viewport
api.fitToView();

// Zoom by factor (1.5 = 150%, 0.5 = 50%)
api.zoom(1.5);

// Rotate by degrees (positive = clockwise)
api.rotate(90);
```

## Interaction Controls

### Mouse Controls

- **Left Click + Drag**: Pan the image
- **Mouse Wheel**: Zoom in/out at cursor position

### Touch Controls

- **Single Touch + Drag**: Pan the image
- **Pinch Gesture**: Zoom in/out at gesture center
- **Two Finger Touch**: Multi-touch zoom and pan

### Keyboard Support

The component is focusable and can receive keyboard events when focused.

## Architecture

The image viewer uses a sophisticated architecture for optimal performance:

### Web Worker Architecture

- **Main Thread**: Handles UI interactions and event management
- **Worker Thread**: Performs all canvas operations and image transformations
- **OffscreenCanvas**: Enables GPU-accelerated rendering off the main thread

### Performance Optimizations

- **Frame Rate Limiting**: Interactions are throttled to 100fps to prevent overwhelming the system
- **Transferable Objects**: Efficiently passes data between main thread and worker
- **Smart Rendering**: Only redraws when necessary
- **Image Smoothing**: Automatically adjusted based on zoom level

### Canvas Management

The component uses a `WorkerView` class that provides:

- Viewport calculations and transformations
- Scale, rotation, and translation management
- Automatic image centering and fitting
- Boundary constraints and limits

## Styling

The component can be styled with CSS:

```css
iv-image-viewer {
  width: 800px;
  height: 600px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

/* The component focuses cleanly */
iv-image-viewer:focus {
  outline: 2px solid #0066cc;
}
```

## Advanced Usage

### Custom Controls

```typescript
// Create custom zoom controls
function createZoomControls(viewer) {
  const zoomIn = document.createElement('button');
  zoomIn.textContent = 'Zoom In';
  zoomIn.onclick = () => viewer.adapter.api.zoom(1.2);

  const zoomOut = document.createElement('button');
  zoomOut.textContent = 'Zoom Out';
  zoomOut.onclick = () => viewer.adapter.api.zoom(0.8);

  const reset = document.createElement('button');
  reset.textContent = 'Reset';
  reset.onclick = () => viewer.adapter.api.reset();

  return { zoomIn, zoomOut, reset };
}
```

### Dynamic Image Loading

```typescript
async function loadImage(viewer, imageUrl) {
  try {
    // Set the image source
    viewer.imageSrc = imageUrl;

    // Optionally fit to view after loading
    // The component will handle the loading automatically
    setTimeout(() => {
      viewer.adapter.api.fitToView();
    }, 100);
  } catch (error) {
    console.error('Failed to load image:', error);
  }
}
```

## Browser Support

- **Modern Browsers**: Chrome 69+, Firefox 105+, Safari 15+
- **Required Features**:
  - OffscreenCanvas support
  - Web Workers
  - ImageBitmap API
  - ES2020+ JavaScript features

## Development

### Building

```bash
pnpm install
pnpm build
```

### Development Server

```bash
pnpm dev
```

### Running Demo

```bash
pnpm build-demo
pnpm preview-demo
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the Apache 2.0 License - see the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) for details.

## Related Packages

This component is part of the @arcmantle ecosystem:

- `@arcmantle/adapter-element` - Base web component framework
- `@arcmantle/library` - Core utilities and canvas helpers
- `@arcmantle/lit-jsx` - JSX support for Lit-based components

.
