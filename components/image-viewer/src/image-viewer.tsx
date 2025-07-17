/// <reference types="vite/client" />

import { AdapterElement, property } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { type ResolvablePromise, resolvablePromise } from '@arcmantle/library/async';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import imageWorker from './image-worker.ts?worker';
import { type ImageWorkerApiIn, type ImageWorkerApiOut, type ImageWorkerApiOutImp, workerApiIn } from './worker-api.ts';
import { createWorkerProxy, makeObjectTransferable, type TransferableWheelEvent, type WorkerApi } from './worker-interface.ts';


export class ImageViewerCmp extends AdapterElement implements ImageWorkerApiOutImp {

	static override tagName = 'iv-image-viewer';
	static fps = 100;

	//#region properties
	protected worker:         Worker & WorkerApi<ImageWorkerApiIn>;
	protected workerReady:    ResolvablePromise<boolean> = resolvablePromise();
	protected resizeObserver: ResizeObserver = new ResizeObserver(([ entry ]) => {
		if (!entry)
			return;

		const { width, height } = entry.contentRect;
		this.worker.setSize({ width, height });
	});
	//#endregion


	//#region public-api
	@property(String)  accessor imageSrc: string = '';
	@property(Boolean) accessor resetOnNewImage: boolean = false;
	@property(Boolean) accessor fitOnNewImage: boolean = false;

	api: {
		reset:     () => void;
		fitToView: () => void;
		zoom:      (factor: number) => void;
		rotate:    (degrees: number) => void;
	} = {
		reset:     this.reset    .bind(this),
		fitToView: this.fitToView.bind(this),
		zoom:      this.zoom     .bind(this),
		rotate:    this.rotate   .bind(this),
	};
	//#endregion


	//#region component-lifecycle
	override connected(): void {
		super.connected();

		this.element.tabIndex = 0;
	}

	override afterConnected(): void {
		this.initializeWorker();
	}

	override disconnected(): void {
		super.disconnected();

		this.worker.terminate();
	}

	override beforeUpdate(changedProps: Map<keyof any, any>): void {
		super.beforeUpdate(changedProps);

		if (changedProps.has('imageSrc'))
			this.imageSrcUpdated();
	}
	//#endregion


	//#region logic
	protected async initializeWorker(): Promise<void> {
		const canvas = this.element.shadowRoot!
			.getElementById('image-viewer') as HTMLCanvasElement | null;

		if (!canvas)
			throw new Error('Canvas not found in image viewer');

		this.worker = createWorkerProxy(imageWorker, workerApiIn);

		// The worker will send a message when it is ready
		this.worker.addEventListener('message', () => {
			this.workerReady.resolve(true);
		}, { once: true });

		// We wait for the worker to be ready before we start sending messages
		await this.workerReady;

		const offscreen = canvas.transferControlToOffscreen();
		this.worker.initialize({ canvas: offscreen }, [ offscreen ]);

		this.worker.addEventListener('message', (ev) => {
			if (ev.data.type === 'startViewMove')
				this.startViewMove(ev.data);
			else if (ev.data.type === 'startViewTouchMove')
				this.startViewTouchMove(ev.data);
		});

		// We observe the canvas for size changes\
		// this is done last to ensure we don't send messages before the worker is ready
		this.resizeObserver.observe(this.element);
	}

	protected async imageSrcUpdated(): Promise<void> {
		await this.workerReady;

		if (!this.imageSrc)
			return this.worker.clearImage({});

		const imageResponse = await fetch(this.imageSrc!);
		const imageBlob = await imageResponse.blob();
		const imageBitmap = await createImageBitmap(imageBlob);

		this.worker.setImage({ image: imageBitmap }, [ imageBitmap ]);
	}

	protected reset(): void {
		this.worker.reset({});
	}

	protected fitToView(): void {
		this.worker.fitToView({});
	}

	protected zoom(factor: number): void {
		this.worker.zoom({ factor });
	}

	protected rotate(degrees: number): void {
		this.worker.rotate({ degrees });
	}
	//#endregion


	//#region event-handlers
	protected onMousedown(downEv: MouseEvent): void {
		if (downEv.buttons !== 1)
			return;

		downEv.preventDefault();
		this.element.focus();

		const event = makeObjectTransferable(downEv);
		this.worker.mousedown({ event });
	}

	protected onTouchstart(downEv: TouchEvent): void {
		downEv.preventDefault();
		this.element.focus();

		const event = makeObjectTransferable(downEv);
		const touches = [ ...downEv.touches ].map(touch => makeObjectTransferable(touch));
		const rect = this.element.getBoundingClientRect();

		this.worker.touchstart({ event, touches, rect });
	}

	protected onMousewheel: (ev: WheelEvent) => void = (() => {
		let lastFrameTime: number = performance.now();
		let event: TransferableWheelEvent = undefined as any;

		const fn = (currentTime: number) => {
			const deltaTime = currentTime - lastFrameTime;
			if (deltaTime < 1000 / ImageViewerCmp.fps)
				return;

			lastFrameTime = currentTime;
			const vec = { x: event.offsetX, y: event.offsetY };
			const deltaY = event.deltaY;
			const factor = -deltaY > 0 ? 1.1 : 1 / 1.1;
			this.worker.scaleAt({ vec, factor });
		};

		return (ev: WheelEvent): void => {
			event = makeObjectTransferable(ev);
			requestAnimationFrame(fn);
		};
	})();

	startViewMove(data: ImageWorkerApiOut['startViewMove']['args']): void {
		const rect = this.element.getBoundingClientRect();

		// We setup the mousemove and mouseup events for panning the view
		const mousemove = (() => {
			let ev: MouseEvent = undefined as any;
			let lastFrameTime: number = performance.now();

			const fn = (currentTime: number) => {
				const deltaTime = currentTime - lastFrameTime;
				if (deltaTime < 1000 / ImageViewerCmp.fps)
					return;

				lastFrameTime = currentTime;
				const x = ev.offsetX - rect.x - data.offsetX;
				const y = ev.offsetY - rect.y - data.offsetY;

				this.worker.moveTo({ x, y });
			};

			return (event: MouseEvent) => {
				ev = event; requestAnimationFrame(fn);
			};
		})();

		const mouseup = () => {
			removeEventListener('mousemove', mousemove);
			removeEventListener('mouseup', mouseup);
		};
		addEventListener('mousemove', mousemove);
		addEventListener('mouseup', mouseup);
	};

	startViewTouchMove(data: ImageWorkerApiOut['startViewTouchMove']['args']): void {
		const rect = this.element.getBoundingClientRect();

		const getDistance = (touch1: Touch, touch2: Touch) => {
			const dx = touch2.clientX - touch1.clientX;
			const dy = touch2.clientY - touch1.clientY;

			return Math.sqrt(dx * dx + dy * dy);
		};

		let initialDistance: number | undefined;

		// We setup the mousemove and mouseup events for panning the view
		const touchmove = (() => {
			let ev: TouchEvent = undefined as any;
			let lastFrameTime: number = performance.now();

			const fn = (currentTime: number) => {
				const deltaTime = currentTime - lastFrameTime;
				if (deltaTime < 1000 / ImageViewerCmp.fps)
					return;

				lastFrameTime = currentTime;

				const touch1 = ev.touches[0];
				if (!touch1)
					return touchend(ev);

				// For touch we also need to find out if we are zooming or moving
				if (ev.touches.length === 2) {
					const touch2 = ev.touches[1]!;

					if (initialDistance === undefined)
						initialDistance = getDistance(touch1, touch2);

					const currentDistance = getDistance(touch1, touch2);
					const factor = currentDistance / initialDistance;

					initialDistance = currentDistance;

					const touch1OffsetX = touch1.pageX - rect.x;
					const touch1OffsetY = touch1.pageY - rect.y;
					const touch2OffsetX = touch2.pageX - rect.x;
					const touch2OffsetY = touch2.pageY - rect.y;

					const x = (touch1OffsetX + touch2OffsetX) / 2;
					const y = (touch1OffsetY + touch2OffsetY) / 2;

					this.worker.scaleAt({ vec: { x, y }, factor });
				}
				else {
					const x = touch1.clientX - rect.x - data.offsetX;
					const y = touch1.clientY - rect.y - data.offsetY;

					this.worker.moveTo({ x, y });
				}
			};

			return (event: TouchEvent) => {
				ev = event; requestAnimationFrame(fn);
			};
		})();

		const touchend = (_event: TouchEvent) => {
			removeEventListener('touchmove', touchmove);
			removeEventListener('touchstart', touchend);
			removeEventListener('touchend', touchend);
		};

		addEventListener('touchmove', touchmove);
		addEventListener('touchstart', touchend);
		addEventListener('touchend', touchend);
	}
	//#endregion


	//#region template
	protected override render(): unknown {
		return <canvas
			id="image-viewer"
			on-mousewheel={ this.onMousewheel }
			on-mousedown ={ this.onMousedown }
			on-touchstart={ this.onTouchstart }
		></canvas>;
	}

	static override styles: CSSStyle = css`
		:host {
			outline: none;
		}
	`;
	//#endregion

}

export const ImageViewer: ToComponent<ImageViewerCmp> = toComponent(ImageViewerCmp);
