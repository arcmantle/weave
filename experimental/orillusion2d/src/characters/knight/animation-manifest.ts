/* eslint-disable @stylistic/max-len */
import { type SpriteAnimationDefinition } from '../base/types';

export const KNIGHT_FRAME_WIDTH = 120;
export const KNIGHT_FRAME_HEIGHT = 80;
const OBSERVATION_FPS = 12;

export interface KnightAnimationDefinition extends SpriteAnimationDefinition {
	sheetUrl: string;
}

const defineKnightAnimation = (
	id: string,
	label: string,
	fileName: string,
	nativeFps: number,
	playbackMode?: KnightAnimationDefinition['playbackMode'],
	invertFacing = false,
): KnightAnimationDefinition => ({
	id,
	label,
	sheetUrl: buildSheetUrl(fileName),
	fps:      OBSERVATION_FPS,
	invertFacing,
	nativeFps,
	playbackMode,
});

const sheetModules = import.meta.glob('../../../assets/knight/Colour2/Outline/120x80_PNGSheets/*.png', {
	eager:  true,
	import: 'default',
}) as Record<string, string>;

const buildSheetUrl = (fileName: string): string => {
	const modulePath = `../../../assets/knight/Colour2/Outline/120x80_PNGSheets/${ fileName }`;
	const sheetUrl = sheetModules[modulePath];

	if (!sheetUrl)
		throw new Error(`Missing sprite sheet import for ${ fileName }.`);

	return sheetUrl;
};

export const knightAnimations: KnightAnimationDefinition[] = [
	defineKnightAnimation('idle', 'Idle', '_Idle.png', 6),
	defineKnightAnimation('run', 'Run', '_Run.png', 11),
	defineKnightAnimation('attack', 'Attack', '_Attack.png', 12),
	defineKnightAnimation('attackNoMovement', 'Attack No Movement', '_AttackNoMovement.png', 12),
	defineKnightAnimation('attack2', 'Attack 2', '_Attack2.png', 12),
	defineKnightAnimation('attack2NoMovement', 'Attack 2 No Movement', '_Attack2NoMovement.png', 12),
	defineKnightAnimation('attackCombo', 'Attack Combo', '_AttackCombo.png', 14),
	defineKnightAnimation('attackComboNoMovement', 'Attack Combo No Movement', '_AttackComboNoMovement.png', 14),
	defineKnightAnimation('crouch', 'Crouch', '_Crouch.png', 6),
	defineKnightAnimation('crouchAll', 'Crouch All', '_CrouchAll.png', 8),
	defineKnightAnimation('crouchAttack', 'Crouch Attack', '_CrouchAttack.png', 10),
	defineKnightAnimation('crouchTransition', 'Crouch Transition', '_CrouchTransition.png', 8),
	defineKnightAnimation('crouchWalk', 'Crouch Walk', '_CrouchWalk.png', 8),
	defineKnightAnimation('dash', 'Dash', '_Dash.png', 12),
	defineKnightAnimation('death', 'Death', '_Death.png', 9),
	defineKnightAnimation('deathNoMovement', 'Death No Movement', '_DeathNoMovement.png', 9),
	defineKnightAnimation('fall', 'Fall', '_Fall.png', 8),
	defineKnightAnimation('hit', 'Hit', '_Hit.png', 8),
	defineKnightAnimation('jump', 'Jump', '_Jump.png', 9),
	defineKnightAnimation('jumpFallInbetween', 'Jump Fall Inbetween', '_JumpFallInbetween.png', 8),
	defineKnightAnimation('roll', 'Roll', '_Roll.png', 12, undefined, true),
	defineKnightAnimation('slide', 'Slide', '_Slide.png', 10),
	defineKnightAnimation('slideAll', 'Slide All', '_SlideAll.png', 10),
	defineKnightAnimation('slideTransitionStart', 'Slide Transition Start', '_SlideTransitionStart.png', 10),
	defineKnightAnimation('slideTransitionEnd', 'Slide Transition End', '_SlideTransitionEnd.png', 10),
	defineKnightAnimation('turnAround', 'Turn Around', '_TurnAround.png', 10),
	defineKnightAnimation('wallClimb', 'Wall Climb', '_WallClimb.png', 8),
	defineKnightAnimation('wallClimbNoMovement', 'Wall Climb No Movement', '_WallClimbNoMovement.png', 8),
	defineKnightAnimation('wallHang', 'Wall Hang', '_WallHang.png', 6),
	defineKnightAnimation('wallSlide', 'Wall Slide', '_WallSlide.png', 8),
];

export const knightAnimationMap: Map<string, KnightAnimationDefinition> = new Map(
	knightAnimations.map((definition) => [ definition.id, definition ]),
);

export const knightAnimationLibrary: Readonly<Record<string, KnightAnimationDefinition>> = Object.freeze(
	Object.fromEntries(knightAnimations.map((definition) => [ definition.id, definition ])) as Record<string, KnightAnimationDefinition>,
);
