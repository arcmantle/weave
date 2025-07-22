import { css, type CSSStyle, type Signal } from '@arcmantle/adapter-element/shared';
import { For, type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';


interface GridArea {
	id:       string;
	row:      number;
	col:      number;
	content?: unknown;
}

interface GridLayout {
	columns: string[];
	rows:    string[];
	areas:   GridArea[];
}


export class EditorAreaCmp extends ContentArea {

	static override tagName:  string = 'ho-editor-area';
	override contentLocation: ContentLocation = 'editor';

	protected editorArea:    EditorAreaService = this.inject.get('editor-area');
	private resizeObserver?: ResizeObserver;
	private gridLayout: GridLayout = {
		columns: [ '1fr', '1fr' ],
		rows:    [ '1fr' ],
		areas:   [
			{ id: 'main1', row: 0, col: 0 },
			{ id: 'main2', row: 0, col: 1 },
		],
	};

	private startResize(e: MouseEvent, direction: 'vertical' | 'horizontal', index: number) {
		e.preventDefault();

		const startX = e.clientX;
		const startY = e.clientY;
		const container = this.element.shadowRoot?.querySelector('.editor-grid-container') as HTMLElement;
		const containerRect = container.getBoundingClientRect();

		const handleMouseMove = (e: MouseEvent) => {
			if (direction === 'vertical') {
				const deltaX = e.clientX - startX;
				const containerWidth = containerRect.width;
				const percentChange = (deltaX / containerWidth) * 100;
				this.adjustColumnSize(index, percentChange);
			}
			else {
				const deltaY = e.clientY - startY;
				const containerHeight = containerRect.height;
				const percentChange = (deltaY / containerHeight) * 100;
				this.adjustRowSize(index, percentChange);
			}
		};

		const handleMouseUp = () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	private adjustColumnSize(index: number, percentChange: number) {
		// Convert current grid template to workable values
		const newColumns = [ ...this.gridLayout.columns ];

		// Simple implementation - adjust adjacent columns
		const currentCol = this.parseGridValue(newColumns[index]!);
		const nextCol = this.parseGridValue(newColumns[index + 1]!);

		const adjustment = Math.max(-currentCol + 10, Math.min(percentChange, nextCol - 10));

		newColumns[index] = `${ currentCol + adjustment }%`;
		newColumns[index + 1] = `${ nextCol - adjustment }%`;

		this.gridLayout.columns = newColumns;
		this.updateGridTemplate();
	}

	private adjustRowSize(index: number, percentChange: number) {
		const newRows = [ ...this.gridLayout.rows ];

		const currentRow = this.parseGridValue(newRows[index]!);
		const nextRow = this.parseGridValue(newRows[index + 1]!);

		const adjustment = Math.max(-currentRow + 10, Math.min(percentChange, nextRow - 10));

		newRows[index] = `${ currentRow + adjustment }%`;
		newRows[index + 1] = `${ nextRow - adjustment }%`;

		this.gridLayout.rows = newRows;
		this.updateGridTemplate();
	}

	private parseGridValue(value: string): number {
		// Simple parser for percentage values, could be extended for fr units
		if (value.includes('%'))
			return parseFloat(value);

		return 100 / this.gridLayout.columns.length; // Default equal distribution
	}

	private updateGridTemplate() {
		const container = this.element.shadowRoot?.querySelector('.editor-grid-container') as HTMLElement;
		if (container) {
			container.style.gridTemplateColumns = this.gridLayout.columns.join(' ');
			container.style.gridTemplateRows = this.gridLayout.rows.join(' ');
		}
	}

	// Public methods for splitting areas
	splitVertical(areaId: string): void {
		// Implementation for splitting an area vertically
	}

	splitHorizontal(areaId: string): void {
		// Implementation for splitting an area horizontally
	}

	private renderGridAreas() {
		return <For each={this.gridLayout.areas}>
			{(area) => <div
				data-key={area.id}
				class="grid-area"
				styleList={{
					gridColumn: area.col + 1,
					gridRow:    area.row + 1,
				}}
			>
				<div class="tab-container">
					{/* Tabs would go here */}
					<div class="tab-content">
						Primary content for {area.id}
					</div>
				</div>
			</div>}
		</For>;
	}

	private renderResizeHandles() {
		const handles = [];

		// Vertical resize handles (between columns)
		for (let col = 0; col < this.gridLayout.columns.length - 1; col++) {
			handles.push(
				<div
					data-key={`v-handle-${ col }`}
					class="resize-handle vertical"
					styleList={{
						gridColumn: col + 2,
						gridRow:    '1 / -1',
					}}
					on-mousedown={(e) => this.startResize(e, 'vertical', col)}
				></div>,
			);
		}

		// Horizontal resize handles (between rows)
		for (let row = 0; row < this.gridLayout.rows.length - 1; row++) {
			handles.push(
				<div
					data-key={`h-handle-${ row }`}
					class="resize-handle horizontal"
					styleList={{
						gridRow:    row + 2,
						gridColumn: '1 / -1',
					}}
					on-mousedown={(e) => this.startResize(e, 'horizontal', row)}
				></div>,
			);
		}

		return handles;
	}

	protected override render(): unknown {
		return <>
			<div class="editor-grid-container">
				{this.renderGridAreas()}
				{this.renderResizeHandles()}
			</div>
		</>;
	}

	static override styles: CSSStyle = css`
		:host {
			display: grid;
			border: 1px solid black;
			border-top: none;
			border-right: none;

			background-color: honeydew;
		}
		:host {
			/*display: block;
			height: 100%;
			width: 100%;*/
			/*background-color: honeydew;*/
		}
		.editor-grid-container {
			display: grid;
		}
		.grid-area {
			display: flex;
			flex-direction: column;
			min-width: 100px;
			min-height: 100px;
			border: 1px solid #ddd;
		}
		.tab-container {
			display: flex;
			flex-direction: column;
			height: 100%;
		}
		.tab-content {
			flex: 1;
			padding: 8px;
			overflow: auto;
		}
		.resize-handle {
			background-color: transparent;
			position: relative;
			z-index: 10;
		}
		.resize-handle:hover {
			background-color: #007acc;
		}
		.resize-handle.vertical {
			width: 4px;
			cursor: col-resize;
			margin-left: -2px;
		}
		.resize-handle.horizontal {
			height: 4px;
			cursor: row-resize;
			margin-top: -2px;
		}
		.resize-handle.vertical:hover,
		.resize-handle.horizontal:hover {
			background-color: #007acc;
		}
	`;

}


export const EditorArea: ToComponent<EditorAreaCmp> =
	toComponent(EditorAreaCmp);


export class EditorAreaService {

	visible: Signal<boolean> = layoutPreferences.editorArea.visible;

}
