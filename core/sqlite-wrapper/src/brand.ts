declare const __brand: unique symbol;

interface Brand<B> { [__brand]: B; }

/**
 * Creates a branded type that wraps a base type with additional type-level information.
 * Used for creating distinct types that prevent accidental mixing of similar values.
 */
export type Branded<T, B> = T & Brand<B>;
