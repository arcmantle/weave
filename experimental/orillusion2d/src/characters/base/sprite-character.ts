import { Color, Object3D, UIImage } from '@orillusion/core';

import {
	type CharacterInstance,
	type CharacterStatus,
	type CharacterUpdateContext,
	type SpriteAnimationDefinition,
	type SpriteSheetFrames,
	type SpriteSheetLoader,
} from './types';


const DEFAULT_BASELINE_OFFSET_FACTOR = 0.7;
const WIDTH_SCALE_DIVISOR = 8 / 3;
const HEIGHT_SCALE_DIVISOR = 11 / 4;


export interface SpriteCharacterOptions<
	TDefinition extends SpriteAnimationDefinition,
	TFrames extends SpriteSheetFrames,
> {
	baselineOffsetFactor?: number;
	characterType:         string;
	defaultFrameHeight:    number;
	defaultFrameWidth:     number;
	id:                    string;
	loader:                SpriteSheetLoader<TDefinition, TFrames>;
	panelRoot:             Object3D;
	playing?:              boolean;
	screenX?:              number;
	spriteScale?:          number;
}

interface ScriptedFramePlayback {
	fps:           number;
	frameIndices:  number[];
	sequenceIndex: number;
}

export class SpriteCharacter<
	TDefinition extends SpriteAnimationDefinition,
	TFrames extends SpriteSheetFrames,
	TStatus extends CharacterStatus = CharacterStatus,
> implements CharacterInstance<TStatus> {

	readonly characterType: string;
	readonly id:            string;

	readonly #baselineOffsetFactor: number;
	readonly #defaultFrameHeight:   number;
	readonly #defaultFrameWidth:    number;
	readonly #image:                UIImage;
	readonly #loader:               SpriteSheetLoader<TDefinition, TFrames>;
	readonly #root:                 Object3D;

	#animationToken = 0;
	#currentDefinition:     TDefinition | null = null;
	#currentFrames:         TFrames | null = null;
	#facing:                -1 | 1 = 1;
	#frameIndex = 0;
	#lastFrameTime = 0;
	#motionOffsetY = 0;
	#playbackDirection:     -1 | 1 = 1;
	#playing:               boolean;
	#screenX:               number;
	#screenY = 0;
	#scriptedFramePlayback: ScriptedFramePlayback | null = null;
	#spriteScale:           number | null;
	#viewportHeight = 0;
	#viewportWidth = 0;

	constructor(options: SpriteCharacterOptions<TDefinition, TFrames>) {
		this.id = options.id;
		this.characterType = options.characterType;
		this.#baselineOffsetFactor = options.baselineOffsetFactor ?? DEFAULT_BASELINE_OFFSET_FACTOR;
		this.#defaultFrameHeight = options.defaultFrameHeight;
		this.#defaultFrameWidth = options.defaultFrameWidth;
		this.#loader = options.loader;
		this.#playing = options.playing ?? true;
		this.#screenX = options.screenX ?? 0;
		this.#spriteScale = options.spriteScale ?? null;

		this.#root = new Object3D();
		options.panelRoot.addChild(this.#root);
		this.#image = this.#root.addComponent(UIImage);
		this.#image.color = new Color(1, 1, 1, 0);
	}

	async setAnimation(definition: TDefinition): Promise<void> {
		const animationToken = ++this.#animationToken;
		this.#currentDefinition = definition;
		const frames = await this.#loader.load(definition);
		if (animationToken !== this.#animationToken)
			return;

		this.#currentFrames = frames;
		this.#frameIndex = 0;
		this.#lastFrameTime = performance.now();
		this.#playbackDirection = 1;
		this.#scriptedFramePlayback = null;
		this.#applyFrame();
		this.#layoutSprite();
	}

	setPlaying(playing: boolean): void {
		this.#playing = playing;
		this.#lastFrameTime = performance.now();
	}

	restart(): void {
		this.#frameIndex = 0;
		this.#lastFrameTime = performance.now();
		this.#playbackDirection = 1;
		this.#scriptedFramePlayback = null;
		this.#applyFrame();
		this.#layoutSprite();
	}

	playFrameSequence(frameIndices: readonly number[], fps?: number): void {
		const frames = this.#currentFrames;
		if (!frames || frameIndices.length === 0)
			return;

		const sanitizedFrameIndices = frameIndices
			.map((frameIndex) => Math.max(0, Math.min(frames.frameCount - 1, Math.round(frameIndex))));
		if (sanitizedFrameIndices.length === 0)
			return;

		this.#scriptedFramePlayback = {
			fps:           Math.max(1, fps ?? this.#currentDefinition?.fps ?? 1),
			frameIndices:  sanitizedFrameIndices,
			sequenceIndex: 0,
		};
		this.#frameIndex = sanitizedFrameIndices[0]!;
		this.#playing = true;
		this.#lastFrameTime = performance.now();
		this.#applyFrame();
		this.#layoutSprite();
	}

	stopAtLastFrame(): void {
		if (!this.#currentFrames)
			return;

		this.#frameIndex = Math.max(0, this.#currentFrames.frameCount - 1);
		this.#scriptedFramePlayback = null;
		this.#playing = false;
		this.#lastFrameTime = performance.now();
		this.#applyFrame();
		this.#layoutSprite();
	}

	resize(viewportWidth: number, viewportHeight: number): void {
		this.#viewportWidth = viewportWidth;
		this.#viewportHeight = viewportHeight;
		this.#layoutSprite();
	}

	update(timestamp: number, context: CharacterUpdateContext): boolean {
		this.#layoutSprite();

		const definition = this.#currentDefinition;
		const frames = this.#currentFrames;
		if (!definition || !frames || !this.#playing)
			return false;

		const playbackFps = this.#scriptedFramePlayback?.fps ?? definition.fps;
		const frameDuration = 1000 / playbackFps;
		if (timestamp - this.#lastFrameTime < frameDuration)
			return false;

		const skippedFrames = Math.max(1, Math.floor((timestamp - this.#lastFrameTime) / frameDuration));
		if (this.#scriptedFramePlayback) {
			this.#advanceScriptedFrame(skippedFrames);
		}
		else if (definition.playbackMode === 'ping-pong') {
			for (let skippedFrame = 0; skippedFrame < skippedFrames; skippedFrame += 1)
				this.#advancePingPongFrame(frames.frameCount);
		}
		else {
			this.#frameIndex = (this.#frameIndex + skippedFrames) % frames.frameCount;
		}

		this.#lastFrameTime = timestamp;
		this.#applyFrame();
		this.#layoutSprite();

		return true;
	}

	getStatus(): TStatus | null {
		if (!this.#currentDefinition || !this.#currentFrames)
			return null;

		return this.buildStatus(this.#currentDefinition, this.#currentFrames);
	}

	dispose(): void {
		this.#root.removeFromParent();
	}

	setScreenX(screenX: number): void {
		this.#screenX = screenX;
		this.#layoutSprite();
	}

	moveScreenX(deltaX: number): void {
		this.setScreenX(this.#screenX + deltaX);
	}

	setMotionOffsetY(offsetY: number): void {
		this.#motionOffsetY = offsetY;
		this.#layoutSprite();
	}

	get playing(): boolean {
		return this.#playing;
	}

	get screenX(): number {
		return this.#screenX;
	}

	get screenY(): number {
		return this.#screenY;
	}

	get spriteScale(): number | null {
		return this.#spriteScale;
	}

	get viewportWidth(): number {
		return this.#viewportWidth;
	}

	get viewportHeight(): number {
		return this.#viewportHeight;
	}

	get animationId(): string | null {
		return this.#currentDefinition?.id ?? null;
	}

	get facing(): -1 | 1 {
		return this.#facing;
	}

	setFacing(facing: -1 | 1): void {
		this.#facing = facing;
		this.#applyFrame();
		this.#layoutSprite();
	}

	protected get currentDefinition(): TDefinition | null {
		return this.#currentDefinition;
	}

	protected get currentFrames(): TFrames | null {
		return this.#currentFrames;
	}

	protected buildStatus(definition: TDefinition, frames: TFrames): TStatus {
		return {
			animationId:    definition.id,
			animationLabel: definition.label,
			characterId:    this.id,
			characterType:  this.characterType,
			fps:            definition.fps,
			frameCount:     frames.frameCount,
			frameHeight:    frames.frameHeight,
			frameIndex:     this.#frameIndex,
			frameWidth:     frames.frameWidth,
			sheetHeight:    frames.height,
			sheetWidth:     frames.width,
			playing:        this.#playing,
		} as TStatus;
	}

	#layoutSprite(): void {
		if (this.#viewportWidth <= 0 || this.#viewportHeight <= 0)
			return;

		const frameWidth = this.#currentFrames?.frameWidth ?? this.#defaultFrameWidth;
		const frameHeight = this.#currentFrames?.frameHeight ?? this.#defaultFrameHeight;
		const scale = this.#spriteScale ?? this.#resolveSpriteScale(frameWidth, frameHeight);
		const contentBottomInset = (this.#currentFrames?.contentBottomInset ?? 0) * scale;

		this.#spriteScale = scale;
		this.#image.uiTransform.resize(frameWidth * scale, frameHeight * scale);
		this.#image.uiTransform.x = this.#screenX + this.#resolveFacingOffsetX(scale);
		const groundScreenY = this.#currentFrames
			? Math.round((-this.#viewportHeight / 2) + ((frameHeight * scale) / 2) - contentBottomInset)
			: Math.round((-this.#viewportHeight / 2) + (frameHeight * scale * this.#baselineOffsetFactor));
		this.#screenY = groundScreenY + this.#motionOffsetY;
		this.#image.uiTransform.y = this.#screenY;
	}

	protected resolveViewportClampX(direction: 'left' | 'right'): number {
		const frameWidth = this.#currentFrames?.frameWidth ?? this.#defaultFrameWidth;
		const scale = this.#spriteScale
			?? this.#resolveSpriteScale(frameWidth, this.#currentFrames?.frameHeight ?? this.#defaultFrameHeight);
		const renderedFacing = this.#resolveRenderedFacing();

		const frameWidthScaled = frameWidth * scale;
		const facingOffsetX = this.#resolveFacingOffsetX(scale);
		const visibleLeftInset = renderedFacing === -1
			? (this.#currentFrames?.leftContentLeftInset ?? 0) * scale
			: (this.#currentFrames?.contentLeftInset ?? 0) * scale;
		const visibleRightInset = renderedFacing === -1
			? (this.#currentFrames?.leftContentRightInset ?? 0) * scale
			: (this.#currentFrames?.contentRightInset ?? 0) * scale;

		if (direction === 'left') {
			return Math.round(
				(-this.#viewportWidth / 2) - facingOffsetX + (frameWidthScaled / 2) - visibleLeftInset,
			);
		}

		return Math.round(
			(this.#viewportWidth / 2) - facingOffsetX - (frameWidthScaled / 2) + visibleRightInset,
		);
	}

	#resolveSpriteScale(frameWidth: number, frameHeight: number): number {
		const widthScale = this.#viewportWidth / (frameWidth * WIDTH_SCALE_DIVISOR);
		const heightScale = this.#viewportHeight / (frameHeight * HEIGHT_SCALE_DIVISOR);

		return Math.max(3, Math.min(6, Math.floor(Math.min(widthScale, heightScale))));
	}

	#advanceScriptedFrame(skippedFrames: number): void {
		const scriptedFramePlayback = this.#scriptedFramePlayback;
		if (!scriptedFramePlayback)
			return;

		const lastSequenceIndex = scriptedFramePlayback.frameIndices.length - 1;
		scriptedFramePlayback.sequenceIndex = Math.min(
			lastSequenceIndex,
			scriptedFramePlayback.sequenceIndex + skippedFrames,
		);
		this.#frameIndex = scriptedFramePlayback.frameIndices[scriptedFramePlayback.sequenceIndex]!;
		if (scriptedFramePlayback.sequenceIndex >= lastSequenceIndex) {
			this.#scriptedFramePlayback = null;
			this.#playing = false;
		}
	}

	#resolveFacingOffsetX(scale: number): number {
		if (this.#resolveRenderedFacing() !== -1 || !this.#currentFrames)
			return 0;

		return this.#currentFrames.leftOffsetX * scale;
	}

	#resolveRenderedFacing(): -1 | 1 {
		if (!this.#currentDefinition?.invertFacing)
			return this.#facing;

		return this.#facing === 1 ? -1 : 1;
	}

	#advancePingPongFrame(frameCount: number): void {
		if (frameCount <= 1)
			return;

		const nextFrameIndex = this.#frameIndex + this.#playbackDirection;
		if (nextFrameIndex >= frameCount) {
			this.#playbackDirection = -1;
			this.#frameIndex = frameCount - 1;

			return;
		}

		if (nextFrameIndex < 0) {
			this.#playbackDirection = 1;
			this.#frameIndex = 0;

			return;
		}

		this.#frameIndex = nextFrameIndex;
	}

	#applyFrame(): void {
		if (!this.#currentFrames)
			return;

		const frameSet = this.#resolveRenderedFacing() === -1 ? this.#currentFrames.leftSprites : this.#currentFrames.sprites;

		this.#image.sprite = frameSet[this.#frameIndex]!;
		this.#image.color = new Color(1, 1, 1, 1);
	}

}
