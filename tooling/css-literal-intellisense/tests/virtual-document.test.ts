import { describe, expect, it } from 'vitest';

import { detectCSSRegions } from '../src/css-region-detector';
import {
	isDiagnosticInPlaceholder,
	isOffsetInRegion,
	sourceToVirtualOffset,
	virtualToSourceOffset,
} from '../src/offset-mapping';


describe('virtual-document offset mapping', () => {
	describe('simple (no interpolation) mapping', () => {
		it('should map virtual offset to source offset correctly', () => {
			const source = `const s = css\`:host { color: red; }\`;`;
			const regions = detectCSSRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
			const region = regions[0]!;

			// First char of CSS content is ':' in :host
			const virtualOffset = 0;
			const sourceOffset = virtualToSourceOffset(region, virtualOffset);
			expect(sourceOffset).toBeDefined();

			// The source text at this offset should be ':'
			expect(source[sourceOffset!]).toBe(':');
		});

		it('should roundtrip source → virtual → source', () => {
			const source = `const s = css\`:host { color: red; }\`;`;
			const regions = detectCSSRegions(source, 'test.ts');
			const region = regions[0]!;

			// Pick a source offset inside the region
			const cssStart = source.indexOf(':host');
			const virtualOff = sourceToVirtualOffset(region, cssStart);
			expect(virtualOff).toBeDefined();

			const backToSource = virtualToSourceOffset(region, virtualOff!);
			expect(backToSource).toBe(cssStart);
		});
	});

	describe('interpolated template mapping', () => {
		it('should return undefined for offsets in placeholders', () => {
			const source = `const s = css\`a { color: \${v}; }\`;`;
			const regions = detectCSSRegions(source, 'test.ts');
			const region = regions[0]!;

			// Find a placeholder range
			expect(region.placeholders).toHaveLength(1);
			const ph = region.placeholders[0]!;

			// An offset inside the placeholder should return undefined
			const midPlaceholder = ph.virtualStart + 1;
			expect(virtualToSourceOffset(region, midPlaceholder)).toBeUndefined();
		});

		it('should correctly map offsets after interpolation', () => {
			const source = `const s = css\`a { color: \${v}; }\`;`;
			const regions = detectCSSRegions(source, 'test.ts');
			const region = regions[0]!;

			// The "; }" part comes after the interpolation
			// In the virtual doc, after the placeholder we should find "; }"
			const semiPos = region.cssText.indexOf('; }');
			expect(semiPos).toBeGreaterThan(0);

			const sourceOff = virtualToSourceOffset(region, semiPos);
			expect(sourceOff).toBeDefined();
			expect(source[sourceOff!]).toBe(';');
		});
	});

	describe('isOffsetInRegion', () => {
		it('should return true for offsets inside the region', () => {
			const source = `const s = css\`:host { color: red; }\`;`;
			const regions = detectCSSRegions(source, 'test.ts');
			const region = regions[0]!;

			const insideOffset = region.start + 1;
			expect(isOffsetInRegion(region, insideOffset)).toBe(true);
		});

		it('should return false for offsets outside the region', () => {
			const source = `const s = css\`:host { color: red; }\`;`;
			const regions = detectCSSRegions(source, 'test.ts');
			const region = regions[0]!;

			expect(isOffsetInRegion(region, 0)).toBe(false);
		});
	});

	describe('isDiagnosticInPlaceholder', () => {
		it('should detect overlap with placeholder', () => {
			const source = `const s = css\`a { color: \${v}; }\`;`;
			const regions = detectCSSRegions(source, 'test.ts');
			const region = regions[0]!;
			const ph = region.placeholders[0]!;

			expect(isDiagnosticInPlaceholder(region, ph.virtualStart, ph.virtualEnd)).toBe(true);
			expect(isDiagnosticInPlaceholder(
				region,
				ph.virtualStart - 1,
				ph.virtualStart + 1,
			)).toBe(true);
		});

		it('should return false for ranges outside placeholders', () => {
			const source = `const s = css\`a { color: \${v}; }\`;`;
			const regions = detectCSSRegions(source, 'test.ts');
			const region = regions[0]!;

			// The very beginning of the CSS before any placeholder
			expect(isDiagnosticInPlaceholder(region, 0, 1)).toBe(false);
		});
	});
});
