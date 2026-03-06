import { describe, expect, it } from 'vitest';

import { detectHTMLRegions } from '../src/html-region-detector';
import {
	isDiagnosticInPlaceholder,
	isOffsetInRegion,
	sourceToVirtualOffset,
	virtualToSourceOffset,
} from '../src/offset-mapping';


describe('virtual-document offset mapping', () => {
	describe('simple (no interpolation) mapping', () => {
		it('should map virtual offset to source offset correctly', () => {
			const source = `const s = html\`<div>Hello</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
			const region = regions[0]!;

			// First char of HTML content is '<' in <div>
			const virtualOffset = 0;
			const sourceOffset = virtualToSourceOffset(region, virtualOffset);
			expect(sourceOffset).toBeDefined();

			// The source text at this offset should be '<'
			expect(source[sourceOffset!]).toBe('<');
		});

		it('should roundtrip source → virtual → source', () => {
			const source = `const s = html\`<div>Hello</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			const region = regions[0]!;

			// Pick a source offset inside the region
			const htmlStart = source.indexOf('<div>');
			const virtualOff = sourceToVirtualOffset(region, htmlStart);
			expect(virtualOff).toBeDefined();

			const backToSource = virtualToSourceOffset(region, virtualOff!);
			expect(backToSource).toBe(htmlStart);
		});
	});

	describe('interpolated template mapping', () => {
		it('should return undefined for offsets in placeholders', () => {
			const source = `const s = html\`<div>\${v}</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			const region = regions[0]!;

			// Find a placeholder range
			expect(region.placeholders).toHaveLength(1);
			const ph = region.placeholders[0]!;

			// An offset inside the placeholder should return undefined
			const midPlaceholder = ph.virtualStart + 1;
			expect(virtualToSourceOffset(region, midPlaceholder)).toBeUndefined();
		});

		it('should correctly map offsets after interpolation', () => {
			const source = `const s = html\`<div>\${v}</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			const region = regions[0]!;

			// The "</div>" part comes after the interpolation
			const closingTag = region.htmlText.indexOf('</div>');
			expect(closingTag).toBeGreaterThan(0);

			const sourceOff = virtualToSourceOffset(region, closingTag);
			expect(sourceOff).toBeDefined();
			expect(source[sourceOff!]).toBe('<');
		});
	});

	describe('isOffsetInRegion', () => {
		it('should return true for offsets inside the region', () => {
			const source = `const s = html\`<div>Hello</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			const region = regions[0]!;

			const insideOffset = region.start + 1;
			expect(isOffsetInRegion(region, insideOffset)).toBe(true);
		});

		it('should return false for offsets outside the region', () => {
			const source = `const s = html\`<div>Hello</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			const region = regions[0]!;

			expect(isOffsetInRegion(region, 0)).toBe(false);
		});
	});

	describe('isDiagnosticInPlaceholder', () => {
		it('should detect overlap with placeholder', () => {
			const source = `const s = html\`<div>\${v}</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
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
			const source = `const s = html\`<div>\${v}</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			const region = regions[0]!;

			// The very beginning of the HTML before any placeholder
			expect(isDiagnosticInPlaceholder(region, 0, 1)).toBe(false);
		});
	});
});
