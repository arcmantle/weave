import { makeAloneSprite } from '@orillusion/core';

export interface SpriteAnimationDefinition {
	id:            string;
	label:         string;
	fps:           number;
	invertFacing?: boolean;
	nativeFps?:    number;
	playbackMode?: 'loop' | 'ping-pong';
}

export interface SpriteSheetFrames {
	baselineOffsetFactor:  number;
	contentBottomInset:    number;
	contentLeftInset:      number;
	contentRightInset:     number;
	contentTopInset:       number;
	frameCount:            number;
	frameHeight:           number;
	frameWidth:            number;
	height:                number;
	leftContentLeftInset:  number;
	leftContentRightInset: number;
	leftOffsetX:           number;
	leftSprites:           ReturnType<typeof makeAloneSprite>[];
	sprites:               ReturnType<typeof makeAloneSprite>[];
	width:                 number;
}

export interface CharacterStatus {
	animationId:    string;
	animationLabel: string;
	characterId:    string;
	characterType:  string;
	fps:            number;
	frameCount:     number;
	frameHeight:    number;
	frameIndex:     number;
	frameWidth:     number;
	motionCommand?: string;
	sheetHeight:    number;
	sheetWidth:     number;
	playing:        boolean;
}

export interface CharacterUpdateContext {
	mouseInside:    boolean;
	mouseScreenX:   number;
	mouseScreenY:   number;
	viewportHeight: number;
	viewportWidth:  number;
}

export interface CharacterInstance<TStatus extends CharacterStatus = CharacterStatus> {
	readonly characterType: string;
	readonly id:            string;

	dispose(): void;
	getStatus(): TStatus | null;
	restart(): void;
	resize(viewportWidth: number, viewportHeight: number): void;
	setPlaying(playing: boolean): void;
	update(timestamp: number, context: CharacterUpdateContext): boolean;
}

export interface SpriteSheetLoader<
	TDefinition extends SpriteAnimationDefinition,
	TFrames extends SpriteSheetFrames,
> {
	load(definition: TDefinition): Promise<TFrames>;
}
