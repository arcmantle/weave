import { type KnightCharacter } from '../characters/knight/knight-character';

export interface Hitbox {
	centerX: number;
	centerY: number;
	height:  number;
	width:   number;
}

const BODY_HEIGHT_WITHIN_CONTENT_FACTOR = 0.86;
const BODY_WIDTH_WITHIN_CONTENT_FACTOR = 0.7;
export const SPRITE_SCALE_FALLBACK = 4;

export const hitboxesIntersect = (left: Hitbox, right: Hitbox): boolean => (
	Math.abs(left.centerX - right.centerX) * 2 < (left.width + right.width)
	&& Math.abs(left.centerY - right.centerY) * 2 < (left.height + right.height)
);

export const resolveKnightBodyHitbox = (character: KnightCharacter): Hitbox => {
	const contentBounds = character.getCurrentContentBounds();
	if (!contentBounds) {
		const scale = character.spriteScale ?? SPRITE_SCALE_FALLBACK;
		const width = 28 * scale;
		const height = 46 * scale;

		return {
			centerX: character.screenX,
			centerY: character.screenY - (height * 0.1),
			height,
			width,
		};
	}

	const width = contentBounds.width * BODY_WIDTH_WITHIN_CONTENT_FACTOR;
	const height = contentBounds.height * BODY_HEIGHT_WITHIN_CONTENT_FACTOR;
	const centerX = contentBounds.centerX;
	const centerY = contentBounds.bottom + (height / 2);

	return {
		centerX,
		centerY,
		height,
		width,
	};
};
