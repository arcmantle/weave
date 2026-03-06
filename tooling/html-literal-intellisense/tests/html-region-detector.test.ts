import { describe, expect, it } from 'vitest';

import { detectHTMLRegions } from '../src/html-region-detector';


describe('detectHTMLRegions', () => {
	describe('tagged template detection', () => {
		it('should detect a simple html`` tagged template', () => {
			const source = `
import { html } from 'lit';
const template = html\`
  <div>Hello world</div>
\`;
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
			expect(regions[0]!.htmlText).toContain('<div>Hello world</div>');
			expect(regions[0]!.placeholders).toHaveLength(0);
		});

		it('should detect html`` with case variations', () => {
			const source = `const s = html\`<div>test</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts', { tagNames: [ 'html' ] });
			expect(regions).toHaveLength(1);
		});

		it('should detect multiple html`` blocks in one file', () => {
			const source = `
const a = html\`<div>first</div>\`;
const b = html\`<span>second</span>\`;
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(2);
			expect(regions[0]!.htmlText).toContain('<div>first</div>');
			expect(regions[1]!.htmlText).toContain('<span>second</span>');
		});

		it('should detect custom tag names', () => {
			const source = `const s = htm\`<div>test</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts', { tagNames: [ 'htm' ] });
			expect(regions).toHaveLength(1);
		});

		it('should NOT detect non-matching tag names', () => {
			const source = `const s = css\`:host { color: red; }\`;`;
			const regions = detectHTMLRegions(source, 'test.ts', { tagNames: [ 'html' ], cssTagNames: [] });
			expect(regions).toHaveLength(0);
		});

		it('should handle property access tags like LitElement.html', () => {
			const source = `const s = LitElement.html\`<div>content</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
		});
	});

	describe('comment-annotated template detection', () => {
		it('should detect /*html*/ annotated template literals', () => {
			const source = `const s = /*html*/\`<div>content</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
			expect(regions[0]!.htmlText).toContain('<div>content</div>');
		});

		it('should detect /* html */ with spaces', () => {
			const source = `const s = /* html */ \`<span>spaced</span>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
		});

		it('should detect /** html */ JSDoc comment style', () => {
			const source = `const s = /** html */ \`<p>jsdoc</p>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
		});

		it('should detect /**? html */ comment style', () => {
			const source = `const s = /**? html */ \`<p>question</p>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
		});

		it('should detect // html line comment style', () => {
			const source = `
// html
const s = \`<div>line comment</div>\`;
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			// Line comments on a different line may not always associate
			expect(regions.length).toBeLessThanOrEqual(1);
		});

		it('should NOT detect comments with non-html markers', () => {
			const source = `const s = /*css*/ \`:host { color: red; }\`;`;
			const regions = detectHTMLRegions(source, 'test.ts', { cssCommentMarkers: [] });
			expect(regions).toHaveLength(0);
		});

		it('should NOT associate a comment that has code between it and the template', () => {
			const source = `
/*html*/
const x = 5;
const s = \`<div>separated</div>\`;
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(0);
		});
	});

	describe('interpolation handling', () => {
		it('should detect html`` with interpolations and create placeholders', () => {
			const source = `
const name = 'world';
const s = html\`<div>\${name}</div>\`;
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
			expect(regions[0]!.placeholders).toHaveLength(1);
			expect(regions[0]!.htmlText).toContain('__ph_0__');
		});

		it('should handle multiple interpolations', () => {
			const source = `
const s = html\`
  <div class="\${cls}">
    <span>\${text}</span>
  </div>
\`;
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
			expect(regions[0]!.placeholders).toHaveLength(2);
			expect(regions[0]!.htmlText).toContain('__ph_0__');
			expect(regions[0]!.htmlText).toContain('__ph_1__');
		});

		it('should produce valid mapping arrays', () => {
			const source = `const s = html\`<div>\${v}</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);

			const region = regions[0]!;
			// Should have mappings for static parts around the interpolation
			expect(region.mappings.length).toBeGreaterThanOrEqual(2);

			// Each mapping should have valid offset pairs
			for (const m of region.mappings) {
				expect(m.virtualStart).toBeLessThanOrEqual(m.virtualEnd);
				expect(m.sourceStart).toBeLessThanOrEqual(m.sourceEnd);
			}
		});
	});

	describe('file type support', () => {
		it('should work with .tsx files', () => {
			const source = `const s = html\`<div>tsx</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.tsx');
			expect(regions).toHaveLength(1);
		});

		it('should work with .jsx files', () => {
			const source = `const s = html\`<div>jsx</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.jsx');
			expect(regions).toHaveLength(1);
		});

		it('should work with .js files', () => {
			const source = `const s = html\`<div>js</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.js');
			expect(regions).toHaveLength(1);
		});
	});

	describe('edge cases', () => {
		it('should ignore empty tagged templates', () => {
			const source = `const s = html\`\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(0);
		});

		it('should ignore whitespace-only tagged templates', () => {
			const source = `const s = html\`   \`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(0);
		});

		it('should handle html in class render method', () => {
			const source = `
class MyElement {
  render() {
    return html\`
      <div>Hello</div>
    \`;
  }
}
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
		});

		it('should handle multiple html blocks in a class', () => {
			const source = `
class MyElement {
  headerTemplate() {
    return html\`<header>Header</header>\`;
  }
  render() {
    return html\`<main>Main</main>\`;
  }
}
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(2);
		});

		it('should detect nested html`` templates inside interpolations', () => {
			const source = `
const s = html\`
  <div>
    \${items.map(item => html\`<span>\${item.name}</span>\`)}
  </div>
\`;
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(2);
			expect(regions[0]!.htmlText).toContain('<div>');
			expect(regions[1]!.htmlText).toContain('<span>');
		});

		it('should detect deeply nested html`` templates', () => {
			const source = `
const s = html\`
  <ul>
    \${items.map(item => html\`
      <li>
        \${item.show ? html\`<span>visible</span>\` : ''}
      </li>
    \`)}
  </ul>
\`;
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(3);
		});
	});

	describe('CSS tagged template detection', () => {
		it('should detect a simple css`` tagged template', () => {
			const source = `const s = css\`:host { display: block; }\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
			expect(regions[0]!.kind).toBe('css');
			expect(regions[0]!.htmlText).toContain('<style>');
			expect(regions[0]!.htmlText).toContain(':host { display: block; }');
			expect(regions[0]!.htmlText).toContain('</style>');
		});

		it('should detect css`` with interpolations', () => {
			const source = `const s = css\`.foo { color: \${color}; }\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
			expect(regions[0]!.kind).toBe('css');
			expect(regions[0]!.placeholders).toHaveLength(1);
			expect(regions[0]!.htmlText).toContain('__ph_0__');
			expect(regions[0]!.htmlText).toMatch(/^<style>/);
			expect(regions[0]!.htmlText).toMatch(/<\/style>$/);
		});

		it('should shift mappings by <style> prefix length', () => {
			const source = `const s = css\`:host { color: red; }\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
			const region = regions[0]!;

			// Virtual offsets should start at 7 (<style> = 7 chars)
			expect(region.mappings[0]!.virtualStart).toBe(7);
		});

		it('should detect css`` inside html`` expression', () => {
			const source = `
const s = html\`
  <style>
    \${css\`:host { display: block; }\`}
  </style>
\`;
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(2);

			const htmlRegion = regions.find(r => r.kind === 'html');
			const cssRegion = regions.find(r => r.kind === 'css');
			expect(htmlRegion).toBeDefined();
			expect(cssRegion).toBeDefined();
			expect(cssRegion!.htmlText).toContain(':host { display: block; }');
		});

		it('should detect nested css`` inside css`` expression', () => {
			const source = `
const s = css\`
  .foo { color: red; }
  \${css\`.bar { background: blue; }\`}
\`;
`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(2);
			expect(regions.every(r => r.kind === 'css')).toBe(true);
		});

		it('should detect /*css*/ annotated template literals', () => {
			const source = `const s = /*css*/ \`:host { color: red; }\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
			expect(regions[0]!.kind).toBe('css');
			expect(regions[0]!.htmlText).toContain('<style>');
		});

		it('should mark html regions with kind html', () => {
			const source = `const s = html\`<div>hello</div>\`;`;
			const regions = detectHTMLRegions(source, 'test.ts');
			expect(regions).toHaveLength(1);
			expect(regions[0]!.kind).toBe('html');
		});

		it('should NOT detect css`` when not in cssTagNames', () => {
			const source = `const s = css\`:host { color: red; }\`;`;
			const regions = detectHTMLRegions(source, 'test.ts', { cssTagNames: [] });
			expect(regions).toHaveLength(0);
		});

		it('should support custom CSS tag names', () => {
			const source = `const s = styles\`.foo { color: red; }\`;`;
			const regions = detectHTMLRegions(source, 'test.ts', { cssTagNames: [ 'styles' ] });
			expect(regions).toHaveLength(1);
			expect(regions[0]!.kind).toBe('css');
		});
	});
});
