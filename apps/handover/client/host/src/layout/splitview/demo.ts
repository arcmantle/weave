import { type IView, Orientation, SplitView } from './index.ts';

/**
 * Simple example view implementation
 */
class SimpleView implements IView {

	readonly element:            HTMLElement;
	readonly minimumSize:        number;
	readonly maximumSize:        number;
	readonly proportionalLayout: boolean;
	readonly snap:               boolean;

	private onDidChangeCallbacks: ((size?: number) => void)[] = [];

	constructor(
		content: string,
		options: {
			minimumSize?:        number;
			maximumSize?:        number;
			proportionalLayout?: boolean;
			snap?:               boolean;
		} = {},
	) {
		this.element = document.createElement('div');
		this.element.classList.add('simple-view');
		this.element.textContent = content;
		this.element.style.cssText = `
			padding: 16px;
			background: #f5f5f5;
			border: 1px solid #ddd;
			overflow: auto;
			display: flex;
			align-items: center;
			justify-content: center;
			font-family: system-ui, sans-serif;
		`;

		this.minimumSize = options.minimumSize ?? 100;
		this.maximumSize = options.maximumSize ?? Number.POSITIVE_INFINITY;
		this.proportionalLayout = options.proportionalLayout ?? true;
		this.snap = options.snap ?? false;
	}

	onDidChange(callback: (size?: number) => void): void {
		this.onDidChangeCallbacks.push(callback);
	}

	layout(size: number, _offset: number, _context: undefined): void {
		// The splitview will handle positioning, we just need to update our size
		console.log(`View "${ this.element.textContent }" sized to: ${ size }px`);
	}

	setVisible(visible: boolean): void {
		this.element.style.display = visible ? 'flex' : 'none';
	}

}

/**
 * Create a demo splitview system
 */
export function createSplitViewDemo(container: HTMLElement): void {
	// Clear container
	container.innerHTML = '';
	container.style.cssText = `
		width: 100%;
		height: 400px;
		border: 2px solid #333;
		position: relative;
	`;

	// Create splitview
	const splitView = new SplitView(container, {
		orientation: Orientation.HORIZONTAL,
	});

	// Create views
	const view1 = new SimpleView('Sidebar', {
		minimumSize: 150,
		maximumSize: 400,
	});

	const view2 = new SimpleView('Main Content', {
		minimumSize: 200,
	});

	const view3 = new SimpleView('Inspector', {
		minimumSize: 100,
		maximumSize: 300,
	});

	// Add views to splitview
	splitView.addView(view1, 200);
	splitView.addView(view2, 400);
	splitView.addView(view3, 150);

	// Layout the splitview
	splitView.layout(750);

	// Add some controls
	const controls = document.createElement('div');
	controls.style.cssText = `
		margin-top: 16px;
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	`;

	const addVerticalSplitButton = document.createElement('button');
	addVerticalSplitButton.textContent = 'Add Vertical Split';
	addVerticalSplitButton.onclick = () => {
		// Create vertical splitview inside main content
		const verticalContainer = document.createElement('div');
		verticalContainer.style.cssText = 'width: 100%; height: 100%;';

		view2.element.innerHTML = '';
		view2.element.appendChild(verticalContainer);

		const verticalSplit = new SplitView(verticalContainer, {
			orientation: Orientation.VERTICAL,
		});

		const topView = new SimpleView('Top Panel', { minimumSize: 50 });
		const bottomView = new SimpleView('Bottom Panel', { minimumSize: 50 });

		verticalSplit.addView(topView, 150);
		verticalSplit.addView(bottomView, 150);
		verticalSplit.layout(300);
	};

	const distributeButton = document.createElement('button');
	distributeButton.textContent = 'Distribute Evenly';
	distributeButton.onclick = () => {
		splitView.distributeViewSizes();
	};

	const resizeContainerButton = document.createElement('button');
	resizeContainerButton.textContent = 'Resize Container';
	resizeContainerButton.onclick = () => {
		const newWidth = container.offsetWidth === 750 ? 900 : 750;
		container.style.width = `${ newWidth }px`;
		splitView.layout(newWidth);
	};

	controls.appendChild(addVerticalSplitButton);
	controls.appendChild(distributeButton);
	controls.appendChild(resizeContainerButton);

	container.parentElement?.appendChild(controls);

	// Log events
	splitView.onDidSashChange((index) => {
		console.log(`Sash ${ index } was resized`);
		console.log('Current view sizes:', [
			splitView.getViewSize(0),
			splitView.getViewSize(1),
			splitView.getViewSize(2),
		]);
	});

	splitView.onDidSashReset((index) => {
		console.log(`Sash ${ index } was double-clicked`);
	});
}

// Auto-create demo if we're in a browser environment
if (typeof window !== 'undefined' && document.getElementById('splitview-demo')) {
	const demoContainer = document.getElementById('splitview-demo')!;
	createSplitViewDemo(demoContainer);
}
