# SplitView System

A VSCode-inspired splitview implementation that provides flexible, resizable layout panels with sophisticated constraint handling and proportional layout support.

## Features

- **Flexible Layout**: Support for both horizontal and vertical orientations
- **Constraint-Based Resizing**: Min/max size constraints with priority-based distribution
- **Proportional Layout**: Maintains proportional sizing when container resizes
- **Snap Support**: Views can snap to minimum sizes for collapsing panels
- **Alt-Key Behavior**: macOS-style Alt+drag for alternative resize behavior
- **Touch Support**: Ready for touch/gesture events (extensible)
- **Accessible**: Proper ARIA attributes and keyboard navigation support

## Basic Usage

```typescript
import { SplitView, Orientation, LayoutPriority, type IView } from './splitview';

// Create a view implementation
class MyView implements IView {
  readonly element: HTMLElement;
  readonly minimumSize = 100;
  readonly maximumSize = 500;
  readonly priority = LayoutPriority.Normal;

  constructor(content: string) {
    this.element = document.createElement('div');
    this.element.textContent = content;
  }

  onDidChange(callback: (size?: number) => void): void {
    // Handle constraint changes
  }

  layout(size: number, offset: number, context: undefined): void {
    // Handle layout updates
  }
}

// Create splitview
const container = document.getElementById('my-container')!;
const splitView = new SplitView(container, {
  orientation: Orientation.HORIZONTAL,
  proportionalLayout: true
});

// Add views
const view1 = new MyView('Sidebar');
const view2 = new MyView('Main Content');
const view3 = new MyView('Inspector');

splitView.addView(view1, 200);  // Fixed size
splitView.addView(view2, { type: 'distribute' });  // Fill remaining space
splitView.addView(view3, 150);

// Layout with container size
splitView.layout(800);
```

## View Interface

Every view must implement the `IView` interface:

```typescript
interface IView<TLayoutContext = undefined> {
  // Required properties
  readonly element: HTMLElement;          // The DOM element
  readonly minimumSize: number;           // Minimum size in pixels
  readonly maximumSize: number;           // Maximum size in pixels

  // Optional properties
  readonly priority?: LayoutPriority;     // Resize priority (Low, Normal, High)
  readonly proportionalLayout?: boolean;  // Participates in proportional layout
  readonly snap?: boolean;                // Can snap to minimum size

  // Required methods
  onDidChange(callback: (size?: number) => void): void;
  layout(size: number, offset: number, context: TLayoutContext | undefined): void;

  // Optional methods
  setVisible?(visible: boolean): void;    // Handle visibility changes
}
```

## Sizing Options

When adding views, you can specify different sizing strategies:

```typescript
// Fixed size
splitView.addView(view, 200);

// Distribute remaining space evenly
splitView.addView(view, { type: 'distribute' });

// Split size with another view
splitView.addView(view, { type: 'split', index: 0 });

// Auto-detect best strategy
splitView.addView(view, { type: 'auto', index: 0 });

// Invisible view (for later showing)
splitView.addView(view, { type: 'invisible', cachedVisibleSize: 200 });
```

## Layout Priorities

Views can have different priorities that affect how resizing is distributed:

- **High Priority**: Resized first, maintains size when possible
- **Normal Priority**: Standard resize behavior
- **Low Priority**: Resized last, gives up space first

```typescript
class PriorityView implements IView {
  readonly priority = LayoutPriority.High;  // This view keeps its size
  // ... other implementation
}
```

## Events

Listen to splitview events:

```typescript
// Sash was dragged
splitView.onDidSashChange((index: number) => {
  console.log(`Sash ${index} was resized`);
  console.log('New sizes:', splitView.getViewSize(0), splitView.getViewSize(1));
});

// Sash was double-clicked
splitView.onDidSashReset((index: number) => {
  console.log(`Sash ${index} was reset`);
});
```

## Advanced Features

### Proportional Layout

When enabled, views maintain their proportional sizes when the container resizes:

```typescript
const splitView = new SplitView(container, {
  proportionalLayout: true  // Default: true
});

// Later, resize the container
splitView.layout(newSize);  // Views maintain proportions
```

### Snapping

Views can snap to their minimum size for collapsible panels:

```typescript
class CollapsibleView implements IView {
  readonly snap = true;           // Enable snapping
  readonly minimumSize = 0;       // Can collapse completely
  // ... other implementation
}
```

### Alt-Key Behavior

Hold Alt while dragging for alternative resize behavior:

```typescript
const splitView = new SplitView(container, {
  inverseAltBehavior: false  // Use macOS-style Alt behavior
});
```

### Manual Distribution

Distribute sizes evenly among all views:

```typescript
splitView.distributeViewSizes();
```

### View Management

```typescript
// Remove a view
const removedView = splitView.removeView(1);

// Get current size
const size = splitView.getViewSize(0);

// Get total content size
const totalSize = splitView.contentSize;
```

## CSS Customization

The splitview includes default styles, but you can customize:

```css
/* Sash appearance */
.sash {
  --sash-active-color: #007acc;
  --sash-hover-color: rgba(0, 122, 204, 0.2);
}

/* View containers */
.split-view-view {
  border: 1px solid #ddd;
}

/* High contrast support */
@media (prefers-contrast: high) {
  .sash {
    --sash-color-high-contrast: #000;
  }
}
```

## TypeScript Support

Full TypeScript support with generic layout context:

```typescript
interface MyLayoutContext {
  theme: 'light' | 'dark';
  scale: number;
}

class MyView implements IView<MyLayoutContext> {
  layout(size: number, offset: number, context: MyLayoutContext | undefined): void {
    if (context?.theme === 'dark') {
      this.element.classList.add('dark-theme');
    }
  }
}

const splitView = new SplitView<MyLayoutContext>(container);
splitView.layout(800, { theme: 'light', scale: 1.0 });
```

## Performance

The splitview is optimized for performance:

- Efficient constraint calculation
- Minimal DOM manipulation during resize
- Proportional layout caching
- Event delegation for sash handling

## Browser Support

- Modern browsers with ES2015+ support
- Touch events (mobile/tablet)
- High contrast mode
- Reduced motion support
- Keyboard navigation (accessible)

## Demo

See `demo.ts` for a complete working example with multiple views and controls.
