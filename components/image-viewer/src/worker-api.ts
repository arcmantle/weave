import type { Vec2 } from '@arcmantle/library/types';

import type { TransferableMouseEvent, TransferableTouches, TransferableTouchEvent, WorkerComs } from './worker-interface.ts';


const _workerApiIn = {
	initialize: {
		args: {
			canvas: undefined as any as OffscreenCanvas,
		},
		serialize: [ undefined as any as OffscreenCanvas ],
	},
	setSize: {
		args: {
			width:  undefined as any as number,
			height: undefined as any as number,
		},
	},
	scaleAt: {
		args: {
			vec:    undefined as any as Vec2,
			factor: undefined as any as number,
		},
	},
	moveTo: {
		args: {
			x: undefined as any as number,
			y: undefined as any as number,
		},
	},
	setImage: {
		args: {
			image: undefined as any as ImageBitmap,
		},
		serialize: [ undefined as any as ImageBitmap ],
	},
	clearImage: {
		args: {},
	},
	reset: {
		args: {},
	},
	fitToView: {
		args: {},
	},
	rotate: {
		args: {
			degrees: undefined as any as number,
		},
	},
	zoom: {
		args: {
			factor: undefined as any as number,
		},
	},
	mousedown: {
		args: {
			event: undefined as any as TransferableMouseEvent,
		},
	},
	touchstart: {
		args: {
			event:   undefined as any as TransferableTouchEvent,
			touches: undefined as any as TransferableTouches[],
			rect:	   undefined as any as DOMRect,
		},
	},
} as const;

export const workerApiIn: typeof _workerApiIn = _workerApiIn satisfies WorkerComs;
export type ImageWorkerApiIn = typeof workerApiIn;
export type ImageWorkerApiInImp = {
	[key in keyof ImageWorkerApiIn]: (data: ImageWorkerApiIn[key]['args']) => void;
};


const _workerApiOut = {
	startViewMove: {
		args: {
			initialMouseX: undefined as any as number,
			initialMouseY: undefined as any as number,
			offsetX:       undefined as any as number,
			offsetY:       undefined as any as number,
		},
	},
	startViewTouchMove: {
		args: {
			initialMouseX: undefined as any as number,
			initialMouseY: undefined as any as number,
			offsetX:       undefined as any as number,
			offsetY:       undefined as any as number,
			scale:         undefined as any as number,
		},
	},
} as const;
export const workerApiOut: typeof _workerApiOut = _workerApiOut satisfies WorkerComs;
export type ImageWorkerApiOut = typeof workerApiOut;
export type ImageWorkerApiOutImp = {
	[key in keyof ImageWorkerApiOut]: (data: ImageWorkerApiOut[key]['args']) => void;
};
