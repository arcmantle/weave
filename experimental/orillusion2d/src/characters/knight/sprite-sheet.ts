import { BitmapTexture2D, GPUTextureFormat, GUITexture, makeGUISprite } from '@orillusion/core';

import { type SpriteSheetFrames } from '../base/types';
import {
	KNIGHT_FRAME_HEIGHT,
	KNIGHT_FRAME_WIDTH,
	type KnightAnimationDefinition,
	knightAnimationMap,
} from './animation-manifest';

const sharedSpriteSheetCache: Map<string, Promise<SpriteSheetFrames>> = new Map();
let sharedLeftFacingOffsetXPromise: Promise<number> | null = null;
const LEFT_FACING_OFFSET_REFERENCE_ANIMATION_ID = 'attackNoMovement';

const loadImage = async (imageUrl: string): Promise<HTMLImageElement> => {
	const image = new Image();
	image.decoding = 'async';
	image.src = imageUrl;
	await image.decode();

	return image;
};

const createBitmap = async (
	source: CanvasImageSource,
	flipY = false,
): Promise<ImageBitmap> => createImageBitmap(source, {
	imageOrientation: flipY ? 'flipY' : 'from-image',
	premultiplyAlpha: 'none',
});

const measureVisualCenterOffsetX = (context: CanvasRenderingContext2D, frameWidth: number): number => {
	const { data } = context.getImageData(0, 0, frameWidth, context.canvas.height);
	let minX = frameWidth;
	let maxX = -1;

	for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex += 4) {
		if (data[pixelIndex + 3] === 0)
			continue;

		const x = (pixelIndex / 4) % frameWidth;
		if (x < minX)
			minX = x;
		if (x > maxX)
			maxX = x;
	}

	if (maxX < 0)
		return 0;

	const visualCenterX = (minX + maxX + 1) / 2;

	return visualCenterX - (frameWidth / 2);
};

interface OpaqueBounds {
	maxX: number;
	maxY: number;
	minX: number;
}

const measureOpaqueBounds = (context: CanvasRenderingContext2D, frameWidth: number, frameHeight: number): OpaqueBounds | null => {
	const { data } = context.getImageData(0, 0, frameWidth, frameHeight);
	let minX = frameWidth;
	let maxX = -1;
	let maxY = -1;

	for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex += 4) {
		if (data[pixelIndex + 3] === 0)
			continue;

		const pixelOffset = pixelIndex / 4;
		const x = pixelOffset % frameWidth;
		const y = Math.floor(pixelOffset / frameWidth);
		if (x < minX)
			minX = x;
		if (x > maxX)
			maxX = x;
		if (y > maxY)
			maxY = y;
	}

	if (maxX < 0 || maxY < 0)
		return null;

	return { maxX, maxY, minX };
};

const createSheetCanvas = (width: number, height: number): HTMLCanvasElement => {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	return canvas;
};

const createFlippedSheetCanvas = (
	image: HTMLImageElement,
	frameWidth: number,
	frameHeight: number,
	frameCount: number,
): HTMLCanvasElement => {
	const canvas = createSheetCanvas(frameWidth * frameCount, frameHeight);
	const context = canvas.getContext('2d');
	if (!context)
		throw new Error('2D canvas context unavailable while building flipped sprite sheet.');

	context.imageSmoothingEnabled = false;
	for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
		const targetX = frameIndex * frameWidth;
		context.save();
		context.translate(targetX + frameWidth, 0);
		context.scale(-1, 1);
		context.drawImage(
			image,
			targetX,
			0,
			frameWidth,
			frameHeight,
			0,
			0,
			frameWidth,
			frameHeight,
		);
		context.restore();
	}

	return canvas;
};

const measureAverageCenterOffsetX = (
	image: CanvasImageSource,
	frameWidth: number,
	frameHeight: number,
	frameCount: number,
): number => {
	const scratchCanvas = createSheetCanvas(frameWidth, frameHeight);
	const scratchContext = scratchCanvas.getContext('2d', { willReadFrequently: true });
	if (!scratchContext)
		throw new Error('2D canvas context unavailable while measuring sprite centers.');

	scratchContext.imageSmoothingEnabled = false;
	const centerOffsetsX: number[] = [];
	for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
		scratchContext.clearRect(0, 0, frameWidth, frameHeight);
		scratchContext.drawImage(
			image,
			frameIndex * frameWidth,
			0,
			frameWidth,
			frameHeight,
			0,
			0,
			frameWidth,
			frameHeight,
		);
		centerOffsetsX.push(measureVisualCenterOffsetX(scratchContext, frameWidth));
	}

	return centerOffsetsX.length === 0
		? 0
		: centerOffsetsX.reduce((total, offset) => total + offset, 0) / centerOffsetsX.length;
};

const createFrameSprite = (
	texture: GUITexture,
	animationId: string,
	frameIndex: number,
	frameWidth: number,
	frameHeight: number,
	suffix = '',
): ReturnType<typeof makeGUISprite> => makeGUISprite(texture, `${ animationId }-${ frameIndex }${ suffix }`, {
	border:            { x: 0, y: 0, z: 0, w: 0 },
	size:              { x: frameWidth, y: frameHeight },
	textureRect:       { x: frameIndex * frameWidth, y: 0, z: frameWidth, w: frameHeight },
	textureRectOffset: { x: 0, y: 0 },
});

export class KnightSpriteSheetLoader {

	readonly #cache: Map<string, Promise<SpriteSheetFrames>>;

	constructor(cache: Map<string, Promise<SpriteSheetFrames>> = sharedSpriteSheetCache) {
		this.#cache = cache;
	}

	load(definition: KnightAnimationDefinition): Promise<SpriteSheetFrames> {
		const cached = this.#cache.get(definition.id);
		if (cached)
			return cached;

		const pending = this.#loadSheet(definition);
		this.#cache.set(definition.id, pending);

		return pending;
	}

	async #loadSharedLeftFacingOffsetX(): Promise<number> {
		if (sharedLeftFacingOffsetXPromise)
			return sharedLeftFacingOffsetXPromise;

		sharedLeftFacingOffsetXPromise = (async () => {
			const referenceDefinition = knightAnimationMap.get(LEFT_FACING_OFFSET_REFERENCE_ANIMATION_ID);
			if (!referenceDefinition)
				throw new Error(`Knight animation ${ LEFT_FACING_OFFSET_REFERENCE_ANIMATION_ID } is missing.`);

			const referenceImage = await loadImage(referenceDefinition.sheetUrl);
			const frameCount = referenceImage.naturalWidth / KNIGHT_FRAME_WIDTH;
			const averageCenterOffsetX = measureAverageCenterOffsetX(
				referenceImage,
				KNIGHT_FRAME_WIDTH,
				KNIGHT_FRAME_HEIGHT,
				frameCount,
			);

			return Math.round(averageCenterOffsetX * 2);
		})();

		return sharedLeftFacingOffsetXPromise;
	}

	async #loadSheet(definition: KnightAnimationDefinition): Promise<SpriteSheetFrames> {
		const sourceImage = await loadImage(definition.sheetUrl);

		if (sourceImage.naturalHeight !== KNIGHT_FRAME_HEIGHT) {
			throw new Error(
				`${ definition.label } expected a height of ${ KNIGHT_FRAME_HEIGHT }px but got ${ sourceImage.naturalHeight }px.`,
			);
		}

		if (sourceImage.naturalWidth % KNIGHT_FRAME_WIDTH !== 0) {
			throw new Error(
				`${ definition.label } width ${ sourceImage.naturalWidth }px is not divisible by ${ KNIGHT_FRAME_WIDTH }px.`,
			);
		}

		const frameCount = sourceImage.naturalWidth / KNIGHT_FRAME_WIDTH;
		const scratchCanvas = createSheetCanvas(KNIGHT_FRAME_WIDTH, KNIGHT_FRAME_HEIGHT);
		const scratchContext = scratchCanvas.getContext('2d', { willReadFrequently: true });
		if (!scratchContext)
			throw new Error('2D canvas context unavailable while measuring sprite frames.');

		scratchContext.imageSmoothingEnabled = false;
		const flippedSheetCanvas = createFlippedSheetCanvas(
			sourceImage,
			KNIGHT_FRAME_WIDTH,
			KNIGHT_FRAME_HEIGHT,
			frameCount,
		);
		const sourceBitmap = await createBitmap(sourceImage, true);
		const flippedSheetBitmap = await createBitmap(flippedSheetCanvas, true);
		const texture = new BitmapTexture2D();
		const leftTexture = new BitmapTexture2D();
		texture.format = GPUTextureFormat.rgba8unorm;
		leftTexture.format = GPUTextureFormat.rgba8unorm;
		texture.source = sourceBitmap;
		leftTexture.source = flippedSheetBitmap;
		const guiTexture = new GUITexture(texture);
		const leftGuiTexture = new GUITexture(leftTexture);
		const baselineOffsets: number[] = [];
		const centerOffsetsX: number[] = [];
		const contentBottomInsets: number[] = [];
		const contentLeftInsets: number[] = [];
		const contentRightInsets: number[] = [];
		const leftSprites: ReturnType<typeof makeGUISprite>[] = [];
		const sprites: ReturnType<typeof makeGUISprite>[] = [];

		for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
			scratchContext.clearRect(0, 0, KNIGHT_FRAME_WIDTH, KNIGHT_FRAME_HEIGHT);
			scratchContext.drawImage(
				sourceImage,
				frameIndex * KNIGHT_FRAME_WIDTH,
				0,
				KNIGHT_FRAME_WIDTH,
				KNIGHT_FRAME_HEIGHT,
				0,
				0,
				KNIGHT_FRAME_WIDTH,
				KNIGHT_FRAME_HEIGHT,
			);
			const opaqueBounds = measureOpaqueBounds(scratchContext, KNIGHT_FRAME_WIDTH, KNIGHT_FRAME_HEIGHT);
			if (opaqueBounds) {
				contentLeftInsets.push(opaqueBounds.minX);
				contentRightInsets.push(KNIGHT_FRAME_WIDTH - opaqueBounds.maxX - 1);
				contentBottomInsets.push(KNIGHT_FRAME_HEIGHT - opaqueBounds.maxY - 1);
				baselineOffsets.push((opaqueBounds.maxY + 1) / KNIGHT_FRAME_HEIGHT);
			}

			centerOffsetsX.push(measureVisualCenterOffsetX(scratchContext, KNIGHT_FRAME_WIDTH));
			sprites.push(createFrameSprite(guiTexture, definition.id, frameIndex, KNIGHT_FRAME_WIDTH, KNIGHT_FRAME_HEIGHT));
			leftSprites.push(createFrameSprite(
				leftGuiTexture,
				definition.id,
				frameIndex,
				KNIGHT_FRAME_WIDTH,
				KNIGHT_FRAME_HEIGHT,
				'-left',
			));
		}

		const averageCenterOffsetX = centerOffsetsX.length === 0
			? 0
			: centerOffsetsX.reduce((total, offset) => total + offset, 0) / centerOffsetsX.length;
		const leftFacingOffsetX = definition.id === LEFT_FACING_OFFSET_REFERENCE_ANIMATION_ID
			? Math.round(averageCenterOffsetX * 2)
			: await this.#loadSharedLeftFacingOffsetX();
		if (definition.id === LEFT_FACING_OFFSET_REFERENCE_ANIMATION_ID && !sharedLeftFacingOffsetXPromise)
			sharedLeftFacingOffsetXPromise = Promise.resolve(leftFacingOffsetX);

		const averageContentLeftInset = contentLeftInsets.length === 0
			? 0
			: contentLeftInsets.reduce((total, inset) => total + inset, 0) / contentLeftInsets.length;
		const averageContentRightInset = contentRightInsets.length === 0
			? 0
			: contentRightInsets.reduce((total, inset) => total + inset, 0) / contentRightInsets.length;
		const minimumContentBottomInset = contentBottomInsets.length === 0
			? 0
			: Math.min(...contentBottomInsets);
		const averageBaselineOffset = baselineOffsets.length === 0
			? 0.7
			: baselineOffsets.reduce((total, offset) => total + offset, 0) / baselineOffsets.length;

		return {
			baselineOffsetFactor:  averageBaselineOffset,
			contentBottomInset:    minimumContentBottomInset,
			contentLeftInset:      Math.round(averageContentLeftInset),
			contentRightInset:     Math.round(averageContentRightInset),
			frameCount,
			frameHeight:           KNIGHT_FRAME_HEIGHT,
			frameWidth:            KNIGHT_FRAME_WIDTH,
			height:                sourceImage.naturalHeight,
			leftContentLeftInset:  Math.round(averageContentRightInset),
			leftContentRightInset: Math.round(averageContentLeftInset),
			leftOffsetX:           leftFacingOffsetX,
			leftSprites,
			sprites,
			width:                 sourceImage.naturalWidth,
		};
	}

}
