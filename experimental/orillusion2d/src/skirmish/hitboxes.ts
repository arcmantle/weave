export interface Hitbox {
	centerX: number;
	centerY: number;
	height:  number;
	width:   number;
}

export const hitboxesIntersect = (left: Hitbox, right: Hitbox): boolean => (
	Math.abs(left.centerX - right.centerX) * 2 < (left.width + right.width)
	&& Math.abs(left.centerY - right.centerY) * 2 < (left.height + right.height)
);
