# TabView

The `TabView` class provides a tabbed interface for displaying multiple editors in a single view container. This is similar to how most code editors handle multiple open files in tabs.

## Features

- **Tabbed Interface**: Display multiple editors with clickable tabs
- **Active Editor**: Only one editor is visible at a time
- **Tab Management**: Add, remove, and switch between tabs
- **Visual Feedback**: Active tab is highlighted differently
- **Close Buttons**: Each tab has a close button
- **Overflow Handling**: Horizontal scrolling for many tabs
- **Drag Integration**: Can be used as a drop target in the drag-drop system

## Basic Usage

```typescript
import { TabView, EditorView } from './splitview';

// Create a TabView
const tabView = new TabView('my-tabs', 'My Tab Group', (editorId) => {
  console.log('Editor closed:', editorId);
});

// Create some editors
const editor1 = new EditorView('file1', 'main.ts', templateFunction);
const editor2 = new EditorView('file2', 'utils.ts', templateFunction);
const editor3 = new EditorView('file3', 'types.ts', templateFunction);

// Add editors to the tab view
tabView.addEditor(editor1);
tabView.addEditor(editor2);
tabView.addEditor(editor3);

// Add the tab view to your layout system
viewManager.addView(tabView);
```

## API Reference

### Constructor

```typescript
constructor(id: string, title: string, onRemove?: (id: string) => void)
```

- `id`: Unique identifier for the tab view
- `title`: Display title for the tab view
- `onRemove`: Optional callback when an editor is closed

### Methods

#### Editor Management

- `addEditor(editor: EditorView): void` - Add an editor to the tab view
- `removeEditor(editorId: string): boolean` - Remove an editor by ID
- `setActiveEditor(editor: EditorView): void` - Switch to a specific editor
- `getActiveEditor(): EditorView | null` - Get the currently active editor
- `findEditor(id: string): EditorView | undefined` - Find an editor by ID

#### Tab Navigation

- `getNextEditor(currentEditor): EditorView | null` - Get next editor in tab order
- `getPreviousEditor(currentEditor): EditorView | null` - Get previous editor in tab order
- `moveTab(editorId: string, newIndex: number): boolean` - Reorder tabs

#### Information

- `getAllEditors(): readonly EditorView[]` - Get all editors
- `get editorCount(): number` - Get number of editors
- `hasEditor(editor: EditorView): boolean` - Check if editor exists

### Properties (readonly)

- `id: string` - Unique identifier
- `title: string` - Display title
- `element: HTMLElement` - DOM element
- `minimumSize: number` - Minimum size constraint (150px)
- `maximumSize: number` - Maximum size constraint (unlimited)

## Integration with Split View System

The `TabView` implements the `IEditorView` interface, so it can be used anywhere an editor view is expected:

```typescript
// Add to main ViewManager
viewManager.addView(tabView, Sizing.Distribute);

// Add to NestedView
nestedView.addEditor(tabView);

// Use in drag-drop operations (future enhancement)
// Editors can be dragged into tab views to create new tabs
```

## Styling

The TabView uses CSS custom properties for theming:

```css
/* Tab container */
--vscode-editorGroupHeader-tabsBackground
--vscode-editorGroupHeader-tabsBorder

/* Inactive tabs */
--vscode-tab-inactiveBackground
--vscode-tab-inactiveForeground
--vscode-tab-inactiveHoverBackground

/* Active tab */
--vscode-tab-activeBackground
--vscode-tab-activeForeground

/* Tab borders */
--vscode-tab-border

/* General */
--vscode-editor-background
--vscode-toolbar-hoverBackground
```

## Example: Creating a Multi-Tab Editor

```typescript
class MultiTabEditor {
  private tabView: TabView;

  constructor() {
    this.tabView = new TabView('editor-tabs', 'Editor', (id) => {
      this.handleCloseFile(id);
    });
  }

  openFile(filename: string, content: string) {
    const editor = new EditorView(
      filename,
      filename,
      this.createFileTemplate(content)
    );

    this.tabView.addEditor(editor);
    this.tabView.setActiveEditor(editor);
  }

  private handleCloseFile(editorId: string) {
    // Handle file closing logic
    this.tabView.removeEditor(editorId);
  }

  private createFileTemplate(content: string) {
    return (context: EditorTemplateContext) => html`
      <div class="file-editor">
        <div class="editor-tab">
          <span>${context.title}</span>
          <button @click=${context.handleClose}>×</button>
        </div>
        <div class="editor-content">
          <textarea>${content}</textarea>
        </div>
      </div>
    `;
  }
}
```

## Future Enhancements

- **Tab Drag-and-Drop**: Ability to reorder tabs by dragging
- **Tab Groups**: Support for splitting tab views
- **Context Menus**: Right-click menus on tabs
- **Keyboard Navigation**: Ctrl+Tab navigation between tabs
- **Tab Icons**: Support for file type icons in tabs
- **Unsaved Indicators**: Visual indicators for modified files
