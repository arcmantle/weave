# @arcmantle/infinite-scroller

A high-performance infinite scrolling component that virtualizes large lists by only rendering visible items. Built with Lit and optimized for smooth scrolling with thousands of items.

## Features

- **🚀 Virtual Scrolling**: Only renders items that are visible in the viewport
- **⚡ High Performance**: Handles thousands of items with minimal memory usage
- **🔄 Dynamic Buffering**: Automatically calculates optimal buffer sizes based on viewport
- **📱 Responsive**: Adapts to container size changes automatically
- **🎯 Smooth Scrolling**: Uses CSS transforms and optimized rendering for 60fps performance
- **🛠️ Abstract Base Class**: Extend and customize for your specific use cases
- **🎨 Styleable**: Full CSS customization with CSS custom properties

## Installation

```bash
npm install @arcmantle/infinite-scroller

pnpm add @arcmantle/infinite-scroller

yarn add @arcmantle/infinite-scroller
```

## Basic Usage

The `InfiniteScroller` is an abstract base class that you extend to create your own infinite scrolling components:

```typescript
import { InfiniteScroller } from '@arcmantle/infinite-scroller';
import { customElement } from 'lit/decorators.js';

@customElement('my-list')
export class MyListComponent extends InfiniteScroller {

  constructor() {
    super();
    this.maxIndex = 10000; // Total number of items
  }

  // Create the DOM element for each list item
  protected createElement(): HTMLElement {
    return document.createElement('my-list-item');
  }

  // Update the element content based on its index
  protected updateElement(element: HTMLElement, index: number): void {
    if (index < 0 || index >= this.maxIndex) {
      element.style.visibility = 'hidden';
      return;
    }

    element.style.visibility = 'visible';
    element.textContent = `Item ${index}`;
  }
}
```

## Advanced Example

Here's a more complete example with custom styling and data:

```typescript
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { InfiniteScroller } from '@arcmantle/infinite-scroller';

interface ListItem {
  id: string;
  title: string;
  description: string;
}

@customElement('data-list')
export class DataListComponent extends InfiniteScroller {

  @property({ type: Array })
  data: ListItem[] = [];

  constructor() {
    super();
    this.maxIndex = this.data.length;
  }

  protected createElement(): HTMLElement {
    return document.createElement('data-list-item');
  }

  protected updateElement(element: DataListItemComponent, index: number): void {
    if (index < 0 || index >= this.data.length) {
      element.style.visibility = 'hidden';
      return;
    }

    element.style.visibility = 'visible';
    element.item = this.data[index];
  }

  // Handle infinite loading
  protected override onScroll(): void {
    super.onScroll();

    // Load more data when near the end
    if ((this.maxIndex - this.position) < 30) {
      this.loadMoreData();
    }
  }

  private async loadMoreData(): Promise<void> {
    const newData = await fetchMoreItems();
    this.data = [...this.data, ...newData];
    this.maxIndex = this.data.length;
  }

  static override styles = css`
    :host {
      --item-height: 80px;
      height: 400px;
      border: 1px solid #ccc;
    }
  `;
}

@customElement('data-list-item')
export class DataListItemComponent extends LitElement {

  @property({ type: Object })
  item?: ListItem;

  protected render() {
    if (!this.item) return html``;

    return html`
      <div class="item">
        <h3>${this.item.title}</h3>
        <p>${this.item.description}</p>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      padding: 16px;
      border-bottom: 1px solid #eee;
    }

    .item h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
    }

    .item p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
  `;
}
```

## Properties

### Core Properties

| Property | Type | Description |
|----------|------|-------------|
| `maxIndex` | `number` | Total number of items in the list |
| `itemHeight` | `number` | Height of each item in pixels |
| `bufferSize` | `number` | Number of items to render outside viewport (calculated automatically) |
| `position` | `number` | Current scroll position as item index (can be fractional) |

### CSS Custom Properties

| Property | Default | Description |
|----------|---------|-------------|
| `--item-height` | `60px` | Height of each list item |

## Methods

### Abstract Methods (Must Implement)

```typescript
// Create a new DOM element for list items
protected abstract createElement(): HTMLElement;

// Update element content based on its index position
protected abstract updateElement(element: HTMLElement, index: number): void;
```

### Public Methods

```typescript
// Get/set scroll position by item index
scroller.position = 100; // Scroll to item 100
const currentPosition = scroller.position;
```

### Lifecycle Hooks

```typescript
// Override to handle scroll events
protected onScroll(): void {
  super.onScroll();
  // Your custom scroll logic
}

// Override to handle resize events
protected onResize(entries?: ResizeObserverEntry[]): boolean {
  const result = super.onResize(entries);
  // Your custom resize logic
  return result;
}
```

## Architecture

### Virtual Scrolling Strategy

The infinite scroller uses a dual-buffer strategy:

1. **Two Buffers**: Maintains two buffer zones that contain rendered items
2. **Dynamic Translation**: Buffers are translated vertically as the user scrolls
3. **Automatic Sizing**: Buffer size is calculated based on viewport height
4. **Smart Updates**: Only updates items that are actually visible

### Buffer Management

```text
┌─────────────────┐
│   Buffer 0      │ ← Contains items 0-19
├─────────────────┤
│   Buffer 1      │ ← Contains items 20-39
├─────────────────┤
│   (Virtual)     │ ← Items 40+ not rendered
└─────────────────┘
```

As the user scrolls down:

- Buffer 0 moves below Buffer 1 and updates to show items 40-59
- Buffer 1 continues showing items 20-39
- The cycle continues seamlessly

### Performance Optimizations

- **CSS Transforms**: Uses `translate3d()` for hardware acceleration
- **Passive Scrolling**: Scroll listeners are passive for better performance
- **ResizeObserver**: Efficiently handles container size changes
- **Minimal DOM**: Only creates elements that fit in the buffers
- **Smart Updates**: Only updates visible elements during scroll

## Events

### Custom Events

```typescript
// Fired when the scroller is ready and initialized
scroller.addEventListener('ready', (event) => {
  console.log('Scroller is ready');
});
```

### Native Events

The component supports all standard scroll events on the internal scroller element.

## Styling

### Basic Styling

```css
my-list {
  --item-height: 100px;
  height: 500px;
  width: 100%;
  border: 1px solid #ddd;
}
```

### Advanced Styling with CSS Parts

```css
my-list::part(scroller) {
  border-radius: 8px;
  background: #f9f9f9;
}

my-list::part(buffer) {
  /* Style the buffer containers */
}
```

### Responsive Design

```css
my-list {
  --item-height: 60px;
  height: 100%;
}

@media (max-width: 768px) {
  my-list {
    --item-height: 80px;
  }
}
```

## Common Patterns

### Infinite Loading

```typescript
protected override onScroll(): void {
  super.onScroll();

  const threshold = 50; // Items from end
  if ((this.maxIndex - this.position) < threshold) {
    this.loadMoreItems();
  }
}

private async loadMoreItems(): Promise<void> {
  if (this.loading) return;

  this.loading = true;
  const newItems = await this.dataService.fetchMore();
  this.data.push(...newItems);
  this.maxIndex = this.data.length;
  this.loading = false;
}
```

### Search and Filter

```typescript
private filteredData: Item[] = [];

search(query: string): void {
  this.filteredData = this.allData.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );
  this.maxIndex = this.filteredData.length;
  this.position = 0; // Reset to top
}

protected updateElement(element: HTMLElement, index: number): void {
  const item = this.filteredData[index];
  // Update element with filtered data
}
```

### Dynamic Item Heights

For variable item heights, calculate and cache heights:

```typescript
private itemHeights = new Map<number, number>();

protected override get itemHeight(): number {
  // Return average height or base height
  return this.averageItemHeight || 60;
}

protected updateElement(element: HTMLElement, index: number): void {
  super.updateElement(element, index);

  // Measure and cache actual height
  requestAnimationFrame(() => {
    const height = element.getBoundingClientRect().height;
    this.itemHeights.set(index, height);
  });
}
```

## Browser Support

- **Modern Browsers**: Chrome 69+, Firefox 63+, Safari 12+
- **Required Features**:
  - ResizeObserver API
  - CSS Grid Layout
  - CSS Custom Properties
  - ES2020+ JavaScript features

## Performance Tips

1. **Keep Updates Light**: Minimize work in `updateElement()`
2. **Use CSS for Styling**: Prefer CSS over JavaScript for visual changes
3. **Batch DOM Updates**: Group multiple changes together
4. **Profile Your Code**: Use browser dev tools to identify bottlenecks
5. **Consider Item Complexity**: Simpler items = better performance

## Troubleshooting

### Common Issues

**Items not updating correctly:**

- Ensure `updateElement()` handles all edge cases
- Check that `maxIndex` is set correctly

**Scrolling feels sluggish:**

- Reduce complexity in `updateElement()`
- Check for memory leaks in item components

**Layout jumping:**

- Ensure consistent `--item-height` values
- Avoid dynamic height changes during scroll

**Buffer size warnings:**

- Increase container height or decrease item height
- Check for CSS issues affecting measurements

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

### Testing

```bash
pnpm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the Apache 2.0 License - see the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) for details.

## Related Packages

This component is part of the @arcmantle ecosystem:

- `@arcmantle/library` - Core utilities and helper functions
- `lit` - The underlying web component framework
