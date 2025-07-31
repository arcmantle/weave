export class SplitViewError extends Error {

	constructor(message: string, readonly code: string) {
		super(message);
		this.name = 'SplitViewError';
	}

}

export const splitViewErrors = {
	targetTooSmall: (targetSize: number, minSize: number): SplitViewError => new SplitViewError(
        `Cannot split: target view would be too small (${ targetSize } < ${ minSize })`,
        'TARGET_TOO_SMALL',
	),
	newViewTooSmall: (newSize: number, minSize: number): SplitViewError => new SplitViewError(
        `Cannot split: new view would be too small (${ newSize } < ${ minSize })`,
        'NEW_VIEW_TOO_SMALL',
	),
	invalidSplitIndex: (index: number, count: number): SplitViewError => new SplitViewError(
        `Invalid split index: ${ index }. Must be between 0 and ${ count }`,
        'INVALID_SPLIT_INDEX',
	),
	invalidCachedVisibleSize: (size: number): SplitViewError => new SplitViewError(
        `Invalid cachedVisibleSize: ${ size }. Must be non-negative`,
        'INVALID_CACHED_VISIBLE_SIZE',
	),
	cachedSizeTooSmall: (cachedSize: number, minSize: number): SplitViewError => new SplitViewError(
        `Invalid cachedVisibleSize: ${ cachedSize } < minimum size ${ minSize }`,
        'CACHED_SIZE_TOO_SMALL',
	),
	cachedSizeTooLarge: (cachedSize: number, maxSize: number): SplitViewError => new SplitViewError(
        `Invalid cachedVisibleSize: ${ cachedSize } > maximum size ${ maxSize }`,
        'CACHED_SIZE_TOO_LARGE',
	),
	indexOutOfBounds: (index: number, count: number): SplitViewError => new SplitViewError(
		  `Index out of bounds: ${ index }. Must be between 0 and ${ count - 1 }`,
		  'INDEX_OUT_OF_BOUNDS',
	),
};
