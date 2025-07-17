# @arcmantle/library

A comprehensive collection of TypeScript utility functions and helpers designed to enhance your development experience. This library provides a treasure trove of powerful, type-safe utilities organized into focused modules for different domains of application development.

## 📦 Installation

Choose your preferred package manager:

```bash
npm install @arcmantle/library
# or
pnpm add @arcmantle/library
# or
yarn add @arcmantle/library
```

## 🚀 Quick Start

Import utilities from specific modules to keep your bundle size optimized:

```typescript
// Import from specific modules
import { debounce, throttle } from '@arcmantle/library/timing';
import { arrayMove, range } from '@arcmantle/library/array';
import { animateTo } from '@arcmantle/library/animation';
import { deepMerge } from '@arcmantle/library/structs';

// Use the utilities
const debouncedHandler = debounce(() => console.log('Hello!'), 300);
const numbers = range(1, 10);
const merged = deepMerge(obj1, obj2);
```

## 📚 Available Modules

### 🎬 Animation (`@arcmantle/library/animation`)

Web animation utilities with accessibility considerations:

- `animateTo()` - Promise-based element animations with keyframes
- `parseDuration()` - Parse CSS duration strings to milliseconds
- `prefersReducedMotion()` - Respect user accessibility preferences
- `setDefaultAnimation()` / `getAnimation()` - Animation registry system
- `animationSpeed` - Global animation speed controls

### 📊 Array (`@arcmantle/library/array`)

Powerful array manipulation and utilities:

- `arrayMove()` - Move elements between indices
- `arrayRemove()` / `arrayRemoveAt()` - Remove elements safely
- `arraySum()` / `arrayObjSum()` - Sum arrays and object properties
- `hasSameElements()` / `hasCommonElement()` - Array comparison
- `findInstanceOf()` - Find instances of specific types
- `randomElement()` - Get random array elements
- `swapItems()` - Swap array elements
- `range()` - Generate number ranges
- `tuple()` - Create strongly-typed tuples

### ⚡ Async (`@arcmantle/library/async`)

Asynchronous programming helpers:

- `maybe()` - Error-safe promise handling with tuple returns
- `resolvablePromise()` - Create promises with external resolve/reject
- `waitForPromises()` - Advanced promise coordination
- `pauseableEvent()` - Event handling with pause/resume
- `cachedPromise()` - Promise result caching
- `sleep()` / `paintCycle()` - Timing utilities

### 🎨 Canvas (`@arcmantle/library/canvas`)

Canvas and graphics utilities:

- `WorkerView` - Web Worker-based canvas rendering

### 📡 Communications (`@arcmantle/library/coms`)

Event and communication patterns:

- `Phenomenon` - Type-safe event system
- `Beholder` - Event listener management
- `Hooks` - Lifecycle and hook patterns

### 🌐 DOM (`@arcmantle/library/dom`)

DOM manipulation and browser APIs:

- **Element utilities**: `findDocumentOrShadowRoot()`, `elementHasAncestor()`
- **Scroll management**: `lockBodyScrolling()`, `scrollIntoView()`, `scrollElementTo()`
- **Events**: `emitEvent()`, `waitForEvent()`, `setEventHandled()`
- **Focus management**: `isTabbable()`, `getTabbableBoundary()`, `hasKeyboardFocus()`
- **Browser detection**: `isMobile()`, `isTouch()`
- **Utilities**: `copyTextToClipboard()`, `notification()`, `storage()`, `domId()`
- **URL/Search params**: Complete search parameter management
- **Modal system**: Built-in modal management
- **Drag system**: Drag and drop utilities

### 🔧 Enum (`@arcmantle/library/enum`)

Enumeration utilities for better type safety.

### 🔄 Function (`@arcmantle/library/function`)

Function composition and utility patterns:

- `bind()` / `unbind()` - Function binding utilities
- `lazy()` - Lazy evaluation patterns
- `noop()` - No-operation function
- `nameof()` - Type-safe property name extraction
- `resolveValueProvider()` - Value provider pattern
- `importPicker()` - Dynamic import utilities

### 📇 IndexDB (`@arcmantle/library/indexdb`)

Browser database management:

- `IndexDBWrapper` - Type-safe IndexedDB abstraction
- `IndexDBSchema` - Database schema management
- Complete database setup and collection management

### 🔄 Iterators (`@arcmantle/library/iterators`)

Advanced iteration patterns and utilities.

### 🧮 Math (`@arcmantle/library/math`)

Mathematical utilities:

- `roundToNearest()` - Round numbers to nearest values

### 🌳 Node Tree (`@arcmantle/library/node-tree`)

Tree data structure utilities:

- `NodeTree` - Complete tree implementation
- `fromSingleObject()` / `fromMultiObject()` / `fromList()` - Tree creation
- `augment()` - Tree node augmentation
- Type-safe tree traversal and manipulation

### 📝 String (`@arcmantle/library/string`)

String manipulation utilities:

- `uppercaseFirstLetter()` - Capitalize first letter
- `camelCaseToWords()` - Convert camelCase to readable words
- `removeSegments()` - Remove string segments
- `trimPostfix()` - Remove string suffixes
- `wordCount()` - Count words in text
- `deIndent()` - Remove indentation
- `format()` - String formatting utilities

### 🏗️ Structs (`@arcmantle/library/structs`)

Data structure utilities and patterns:

- **Object utilities**: `deepMerge()`, `clone()`, `getObjectDiff()`
- **Path utilities**: `readPath()`, `writePath()` for nested object access
- **Collections**: `ObservableSet`, `ObservableMap`, `MirrorMap`
- **Mixins**: `createMixin()`, `compose()`, `hasMixin()`
- **Catalogs**: Advanced cataloging and usage tracking
- **Lazy utilities**: `lazyMap()`, `lazyWeakmap()`
- **Set operations**: `setsHaveSameItems()`, `getEqualItems()`

### ⏱️ Timing (`@arcmantle/library/timing`)

Time-based utilities and performance helpers:

- `debounce()` - Debounce function calls with control methods
- `throttle()` - Throttle function execution
- `accurateTimer()` - High-precision timing utilities

### 🎯 Types (`@arcmantle/library/types`)

Comprehensive TypeScript type utilities:

- **Record types**: `RecordOf`, `ValueOf`, `ObjectKeysToUnion`
- **Union types**: `UnionToIntersection`, `UnionToTuple`, `IsUnion`
- **Utility types**: `Mandatory`, `Optional`, `Writeable`, `DeepWriteable`
- **Path types**: `Path`, `PathValue`, `PathOf` for type-safe object paths
- **Function types**: `Fn`, `AsyncFn`, `CreatorFn`
- **Data types**: `Vec2`, `Vec3`, `Json`
- And many more advanced TypeScript patterns

### ✅ Validation (`@arcmantle/library/validation`)

Runtime validation and type checking:

- **Type guards**: `isObject()`, `isPlainObject()`, `isFunction()`, `isClass()`
- **JSON utilities**: `safeJsonParse()`, `safeJsonStringify()`
- **Range validation**: `isNumberInRange()`, `isRangeInRanges()`
- **Utilities**: `ifDefined()`, `invariant()`, `typeOf()`, `oneOf()`

## 💡 Usage Examples

### Debounced Search

```typescript
import { debounce } from '@arcmantle/library/timing';

const searchHandler = debounce((query: string) => {
  // Perform search
  console.log('Searching for:', query);
}, 300);

// The search will only execute 300ms after the user stops typing
searchInput.addEventListener('input', (e) => {
  searchHandler(e.target.value);
});
```

### Safe Promise Handling

```typescript
import { maybe } from '@arcmantle/library/async';

async function fetchData() {
  const [data, error] = await maybe(fetch('/api/data'));

  if (error) {
    console.error('Failed to fetch:', error);
    return;
  }

  // data is guaranteed to be defined here
  console.log('Success:', data);
}
```

### Array Manipulation

```typescript
import { arrayMove, range, randomElement } from '@arcmantle/library/array';

// Create a range of numbers
const numbers = range(1, 10); // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Move element from index 0 to index 3
arrayMove(numbers, 0, 3); // [2, 3, 4, 1, 5, 6, 7, 8, 9, 10]

// Get a random element
const lucky = randomElement(numbers);
```

### Type-Safe Object Paths

```typescript
import { readPath, writePath } from '@arcmantle/library/structs';

const user = {
  profile: {
    name: 'John',
    settings: {
      theme: 'dark'
    }
  }
};

// Type-safe path reading
const theme = readPath(user, 'profile.settings.theme'); // 'dark'

// Type-safe path writing
writePath(user, 'profile.settings.theme', 'light');
```

### Animation with Accessibility

```typescript
import { animateTo, prefersReducedMotion } from '@arcmantle/library/animation';

const element = document.querySelector('.my-element');

if (!prefersReducedMotion()) {
  await animateTo(element, [
    { transform: 'translateX(0px)' },
    { transform: 'translateX(100px)' }
  ], {
    duration: 300,
    easing: 'ease-out'
  });
}
```

## 🔧 TypeScript Support

This library is built with TypeScript from the ground up, providing excellent type safety and IntelliSense support. All utilities include comprehensive type definitions and many provide advanced type-level programming features.

## 📄 License

Apache-2.0

## 👤 Author

Kristoffer Roen-Lie
