import { Object3D, UIImage } from '@orillusion/core';

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
	#currentDefinition: TDefinition | null = null;
	#currentFrames:     TFrames | null = null;
	#facing:            -1 | 1 = 1;
	#frameIndex = 0;
	#lastFrameTime = 0;
	#motionOffsetY = 0;
	#playing:           boolean;
	#screenX:           number;
	#screenY = 0;
	#spriteScale:       number | null;
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
		this.#applyFrame();
		this.#layoutSprite();
	}

	stopAtLastFrame(): void {
		if (!this.#currentFrames)
			return;

		this.#frameIndex = Math.max(0, this.#currentFrames.frameCount - 1);
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

		const frameDuration = 1000 / definition.fps;
		if (timestamp - this.#lastFrameTime < frameDuration)
			return false;

		const skippedFrames = Math.max(1, Math.floor((timestamp - this.#lastFrameTime) / frameDuration));
		this.#frameIndex = (this.#frameIndex + skippedFrames) % frames.frameCount;
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

		this.#spriteScale = scale;
		this.#image.uiTransform.resize(frameWidth * scale, frameHeight * scale);
		this.#image.uiTransform.x = this.#screenX + this.#resolveFacingOffsetX(scale);
		const groundScreenY = Math.round(
			(-this.#viewportHeight / 2) + (frameHeight * scale * this.#baselineOffsetFactor),
		);
		this.#screenY = groundScreenY + this.#motionOffsetY;
		this.#image.uiTransform.y = this.#screenY;
	}

	#resolveSpriteScale(frameWidth: number, frameHeight: number): number {
		const widthScale = this.#viewportWidth / (frameWidth * WIDTH_SCALE_DIVISOR);
		const heightScale = this.#viewportHeight / (frameHeight * HEIGHT_SCALE_DIVISOR);

		return Math.max(3, Math.min(6, Math.floor(Math.min(widthScale, heightScale))));
	}

	#resolveFacingOffsetX(scale: number): number {
		if (this.#facing !== -1 || !this.#currentFrames)
			return 0;

		return this.#currentFrames.leftOffsetX * scale;
	}

	#applyFrame(): void {
		if (!this.#currentFrames)
			return;

		const frameSet = this.#facing === -1 ? this.#currentFrames.leftSprites : this.#currentFrames.sprites;

		this.#image.sprite = frameSet[this.#frameIndex]!;
	}

}
