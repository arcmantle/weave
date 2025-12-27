import type { Ref } from 'lit/directives/ref.js';

import { type ISashEvent, Orientation, SashState } from './types.ts';


export interface ISashItem {
	sash:       Sash;
	disposable: () => void;
}


export interface ISashLayoutProvider {
	splitViewEl: Ref<HTMLElement>;
	getVerticalSashLeft?(sash: Sash): number;
	getVerticalSashTop?(sash: Sash): number;
	getVerticalSashHeight?(sash: Sash): number;
	getHorizontalSashTop?(sash: Sash): number;
	getHorizontalSashLeft?(sash: Sash): number;
	getHorizontalSashWidth?(sash: Sash): number;
}

export interface ISashOptions {
	readonly orientation: Orientation;
	readonly size?:       number;
}


/**
 * The Sash is the UI component which allows the user to resize other components.
 * It's usually an invisible horizontal or vertical line which, when hovered,
 * becomes highlighted and can be dragged along the perpendicular dimension.
 */
export class Sash {

	constructor(
		container: HTMLElement,
		layoutProvider: ISashLayoutProvider,
		options: ISashOptions,
	) {
		this.layoutProvider = layoutProvider;
		this.orientation = options.orientation;
		this.size = options.size ?? 4;

		this.el = document.createElement('div');
		this.el.className = 'sash';

		if (this.orientation === Orientation.HORIZONTAL)
			this.el.classList.add('horizontal');
		else
			this.el.classList.add('vertical');

		container.appendChild(this.el);

		this.setupEventListeners();
		this.layout();
	}

	private el:             HTMLElement;
	private layoutProvider: ISashLayoutProvider;
	private orientation:    Orientation;
	private size:           number;
	private _state:         SashState = SashState.Enabled;
	private _pointerEventsEnabled = true;

	private readonly onDidStartCallbacks:  ((event: ISashEvent) => void)[] = [];
	private readonly onDidChangeCallbacks: ((event: ISashEvent) => void)[] = [];
	private readonly onDidEndCallbacks:    (() => void)[] = [];
	private readonly onDidResetCallbacks:  (() => void)[] = [];

	get state(): SashState {
		return this._state;
	}

	set state(state: SashState) {
		if (this._state === state)
			return;

		this.el.classList.toggle('disabled', state === SashState.Disabled);
		this.el.classList.toggle('minimum', state === SashState.AtMinimum);
		this.el.classList.toggle('maximum', state === SashState.AtMaximum);

		this._state = state;
	}

	get pointerEventsEnabled(): boolean {
		return this._pointerEventsEnabled;
	}

	set pointerEventsEnabled(enabled: boolean) {
		if (this._pointerEventsEnabled === enabled)
			return;

		this.el.style.pointerEvents = enabled ? '' : 'none';
		this._pointerEventsEnabled = enabled;
	}

	private setupEventListeners(): void {
		// Mouse events
		this.el.addEventListener('mousedown', this.onPointerStart.bind(this));
		this.el.addEventListener('dblclick', this.onPointerDoublePress.bind(this));
	}

	private onPointerStart(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();

		if (this._state === SashState.Disabled)
			return;

		// Get container bounds to convert page coordinates to container-relative coordinates
		const containerElement = this.layoutProvider.splitViewEl.value;
		const containerRect = containerElement?.getBoundingClientRect();
		const containerOffsetX = containerRect?.left ?? 0;
		const containerOffsetY = containerRect?.top ?? 0;

		const startX = event.pageX - containerOffsetX;
		const startY = event.pageY - containerOffsetY;
		const startEvent: ISashEvent = {
			startX,
			currentX: startX,
			startY,
			currentY: startY,
		};

		this.el.classList.add('active');
		this.fireOnDidStart(startEvent);

		const onPointerMove = (e: MouseEvent) => {
			e.preventDefault();
			const moveEvent: ISashEvent = {
				startX,
				currentX: e.pageX - containerOffsetX,
				startY,
				currentY: e.pageY - containerOffsetY,
			};
			this.fireOnDidChange(moveEvent);
		};

		const onPointerUp = () => {
			this.el.classList.remove('active');
			this.fireOnDidEnd();

			document.removeEventListener('mousemove', onPointerMove);
			document.removeEventListener('mouseup', onPointerUp);
		};

		document.addEventListener('mousemove', onPointerMove);
		document.addEventListener('mouseup', onPointerUp);
	}

	private onPointerDoublePress(_event: MouseEvent): void {
		this.fireOnDidReset();
	}

	onDidStart(callback: (event: ISashEvent) => void): void {
		this.onDidStartCallbacks.push(callback);
	}

	onDidChange(callback: (event: ISashEvent) => void): void {
		this.onDidChangeCallbacks.push(callback);
	}

	onDidEnd(callback: () => void): void {
		this.onDidEndCallbacks.push(callback);
	}

	onDidReset(callback: () => void): void {
		this.onDidResetCallbacks.push(callback);
	}

	private fireOnDidStart(event: ISashEvent): void {
		for (const callback of this.onDidStartCallbacks)
			callback(event);
	}

	private fireOnDidChange(event: ISashEvent): void {
		for (const callback of this.onDidChangeCallbacks)
			callback(event);
	}

	private fireOnDidEnd(): void {
		for (const callback of this.onDidEndCallbacks)
			callback();
	}

	private fireOnDidReset(): void {
		for (const callback of this.onDidResetCallbacks)
			callback();
	}

	layout(): void {
		if (this.orientation === Orientation.VERTICAL) {
			if (this.layoutProvider.getVerticalSashLeft)
				this.el.style.left = `${ this.layoutProvider.getVerticalSashLeft(this) - (this.size / 2) }px`;

			if (this.layoutProvider.getVerticalSashTop)
				this.el.style.top = `${ this.layoutProvider.getVerticalSashTop(this) }px`;
		}
		else {
			if (this.layoutProvider.getHorizontalSashTop)
				this.el.style.top = `${ this.layoutProvider.getHorizontalSashTop(this) - (this.size / 2) }px`;

			if (this.layoutProvider.getHorizontalSashLeft)
				this.el.style.left = `${ this.layoutProvider.getHorizontalSashLeft(this) }px`;
		}
	}

	dispose(): void {
		this.onDidStartCallbacks.length = 0;
		this.onDidChangeCallbacks.length = 0;
		this.onDidEndCallbacks.length = 0;
		this.onDidResetCallbacks.length = 0;
		this.el.remove();
	}

}
