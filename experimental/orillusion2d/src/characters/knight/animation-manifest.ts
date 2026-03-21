/* eslint-disable @stylistic/max-len */
import { type SpriteAnimationDefinition } from '../base/types';

export const KNIGHT_FRAME_WIDTH = 120;
export const KNIGHT_FRAME_HEIGHT = 80;

export interface KnightAnimationDefinition extends SpriteAnimationDefinition {
	sheetUrl: string;
}

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
	{ id: 'idle',                  label: 'Idle', sheetUrl: buildSheetUrl('_Idle.png'), fps: 6 },
	{ id: 'run',                   label: 'Run', sheetUrl: buildSheetUrl('_Run.png'), fps: 11 },
	{ id: 'attack',                label: 'Attack', sheetUrl: buildSheetUrl('_Attack.png'), fps: 12 },
	{ id: 'attackNoMovement',      label: 'Attack No Movement', sheetUrl: buildSheetUrl('_AttackNoMovement.png'), fps: 12 },
	{ id: 'attack2',               label: 'Attack 2', sheetUrl: buildSheetUrl('_Attack2.png'), fps: 12 },
	{ id: 'attack2NoMovement',     label: 'Attack 2 No Movement', sheetUrl: buildSheetUrl('_Attack2NoMovement.png'), fps: 12 },
	{ id: 'attackCombo',           label: 'Attack Combo', sheetUrl: buildSheetUrl('_AttackCombo.png'), fps: 14 },
	{ id: 'attackComboNoMovement', label: 'Attack Combo No Movement', sheetUrl: buildSheetUrl('_AttackComboNoMovement.png'), fps: 14 },
	{ id: 'crouch',                label: 'Crouch', sheetUrl: buildSheetUrl('_Crouch.png'), fps: 6 },
	{ id: 'crouchAll',             label: 'Crouch All', sheetUrl: buildSheetUrl('_CrouchAll.png'), fps: 8 },
	{ id: 'crouchAttack',          label: 'Crouch Attack', sheetUrl: buildSheetUrl('_CrouchAttack.png'), fps: 10 },
	{ id: 'crouchTransition',      label: 'Crouch Transition', sheetUrl: buildSheetUrl('_CrouchTransition.png'), fps: 8 },
	{ id: 'crouchWalk',            label: 'Crouch Walk', sheetUrl: buildSheetUrl('_CrouchWalk.png'), fps: 8 },
	{ id: 'dash',                  label: 'Dash', sheetUrl: buildSheetUrl('_Dash.png'), fps: 12 },
	{ id: 'death',                 label: 'Death', sheetUrl: buildSheetUrl('_Death.png'), fps: 9 },
	{ id: 'deathNoMovement',       label: 'Death No Movement', sheetUrl: buildSheetUrl('_DeathNoMovement.png'), fps: 9 },
	{ id: 'fall',                  label: 'Fall', sheetUrl: buildSheetUrl('_Fall.png'), fps: 8 },
	{ id: 'hit',                   label: 'Hit', sheetUrl: buildSheetUrl('_Hit.png'), fps: 8 },
	{ id: 'jump',                  label: 'Jump', sheetUrl: buildSheetUrl('_Jump.png'), fps: 9 },
	{ id: 'jumpFallInbetween',     label: 'Jump Fall Inbetween', sheetUrl: buildSheetUrl('_JumpFallInbetween.png'), fps: 8 },
	{ id: 'roll',                  label: 'Roll', sheetUrl: buildSheetUrl('_Roll.png'), fps: 12 },
	{ id: 'slide',                 label: 'Slide', sheetUrl: buildSheetUrl('_Slide.png'), fps: 10 },
	{ id: 'slideAll',              label: 'Slide All', sheetUrl: buildSheetUrl('_SlideAll.png'), fps: 10 },
	{ id: 'slideTransitionStart',  label: 'Slide Transition Start', sheetUrl: buildSheetUrl('_SlideTransitionStart.png'), fps: 10 },
	{ id: 'slideTransitionEnd',    label: 'Slide Transition End', sheetUrl: buildSheetUrl('_SlideTransitionEnd.png'), fps: 10 },
	{ id: 'turnAround',            label: 'Turn Around', sheetUrl: buildSheetUrl('_TurnAround.png'), fps: 10 },
	{ id: 'wallClimb',             label: 'Wall Climb', sheetUrl: buildSheetUrl('_WallClimb.png'), fps: 8 },
	{ id: 'wallClimbNoMovement',   label: 'Wall Climb No Movement', sheetUrl: buildSheetUrl('_WallClimbNoMovement.png'), fps: 8 },
	{ id: 'wallHang',              label: 'Wall Hang', sheetUrl: buildSheetUrl('_WallHang.png'), fps: 6 },
	{ id: 'wallSlide',             label: 'Wall Slide', sheetUrl: buildSheetUrl('_WallSlide.png'), fps: 8 },
];

export const knightAnimationMap: Map<string, KnightAnimationDefinition> = new Map(
	knightAnimations.map((definition) => [ definition.id, definition ]),
);

export const knightAnimationLibrary: Readonly<Record<string, KnightAnimationDefinition>> = Object.freeze(
	Object.fromEntries(knightAnimations.map((definition) => [ definition.id, definition ])) as Record<string, KnightAnimationDefinition>,
);
