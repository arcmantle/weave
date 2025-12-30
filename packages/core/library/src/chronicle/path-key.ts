/**
 * Generate a cache key from path segments.
 *
 * Uses ASCII Unit Separator (0x1F) as delimiter, which cannot appear in normal
 * string keys, ensuring unambiguous path separation.
 *
 * @param segments - Path segments
 * @returns Cache key string
 */
export const pathKeyOf = (segments: string[]): string => segments.join('\x1f');
