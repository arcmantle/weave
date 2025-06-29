/**
 * Utility type that makes specified properties optional while keeping others required.
 * Takes a target object type and a union of key names to make optional.
 */
export type Optional<
	Target extends Record<keyof any, any>,
	Keys extends string,
> = {
	[P in keyof Target as P extends Keys ? P : never]?: Target[P];
} & {
	[P in keyof Target as P extends Keys ? never : P ]: Target[P];
};
