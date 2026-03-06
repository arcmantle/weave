import { describe, expect, it } from 'vitest';

import { createLitTransform, type LitTransform } from '../src/lit-transform';


describe('createLitTransform', () => {
	describe('no Lit bindings', () => {
		it('should return htmlText unchanged when no bindings present', () => {
			const html = '<div class="foo">Hello</div>';
			const t = createLitTransform(html);

			expect(t.text).toBe(html);
			expect(t.bindings).toHaveLength(0);
		});

		it('should pass offsets through unchanged when no bindings present', () => {
			const html = '<div>Hello</div>';
			const t = createLitTransform(html);

			expect(t.toTransformed(5)).toBe(5);
			expect(t.toOriginal(5)).toBe(5);
		});
	});

	describe('property binding (.attr)', () => {
		it('should strip . prefix from property binding', () => {
			const html = '<input .value="test">';
			const t = createLitTransform(html);

			expect(t.text).toBe('<input value="test">');
			expect(t.bindings).toHaveLength(1);
			expect(t.bindings[0]!.kind).toBe('property');
			expect(t.bindings[0]!.name).toBe('value');
		});

		it('should handle multiple property bindings', () => {
			const html = '<input .value="a" .checked="b">';
			const t = createLitTransform(html);

			expect(t.text).toBe('<input value="a" checked="b">');
			expect(t.bindings).toHaveLength(2);
			expect(t.bindings[0]!.name).toBe('value');
			expect(t.bindings[1]!.name).toBe('checked');
		});
	});

	describe('boolean binding (?attr)', () => {
		it('should strip ? prefix from boolean binding', () => {
			const html = '<button ?disabled="true">';
			const t = createLitTransform(html);

			expect(t.text).toBe('<button disabled="true">');
			expect(t.bindings).toHaveLength(1);
			expect(t.bindings[0]!.kind).toBe('boolean');
			expect(t.bindings[0]!.name).toBe('disabled');
		});
	});

	describe('event binding (@event)', () => {
		it('should replace @ with on for event binding', () => {
			const html = '<button @click="handler">';
			const t = createLitTransform(html);

			expect(t.text).toBe('<button onclick="handler">');
			expect(t.bindings).toHaveLength(1);
			expect(t.bindings[0]!.kind).toBe('event');
			expect(t.bindings[0]!.name).toBe('click');
		});
	});

	describe('mixed bindings', () => {
		it('should handle all binding types together', () => {
			const html = '<my-el .value="a" ?disabled="b" @click="c">';
			const t = createLitTransform(html);

			expect(t.text).toBe('<my-el value="a" disabled="b" onclick="c">');
			expect(t.bindings).toHaveLength(3);
			expect(t.bindings[0]!.kind).toBe('property');
			expect(t.bindings[1]!.kind).toBe('boolean');
			expect(t.bindings[2]!.kind).toBe('event');
		});

		it('should handle bindings with placeholders', () => {
			const html = '<input .value=__ph_0__ ?disabled=__ph_1__ @click=__ph_2__>';
			const t = createLitTransform(html);

			expect(t.text).toBe('<input value=__ph_0__ disabled=__ph_1__ onclick=__ph_2__>');
			expect(t.bindings).toHaveLength(3);
		});
	});

	describe('offset conversion — toTransformed', () => {
		it('should map offsets before the first binding unchanged', () => {
			const html = '<div .value="x">';
			const t = createLitTransform(html);

			expect(t.toTransformed(0)).toBe(0); // '<'
			expect(t.toTransformed(4)).toBe(4); // ' '
		});

		it('should shift offsets after a removed prefix by -1', () => {
			const html = '<div .value="x">';
			const t = createLitTransform(html);
			// orig[6] = 'v' → trans[5] = 'v'

			expect(t.toTransformed(6)).toBe(5);
			expect(t.toTransformed(11)).toBe(10); // '='
		});

		it('should handle @event which grows by +1', () => {
			const html = '<div @click="x">';
			const t = createLitTransform(html);
			// orig: <div @click="x">
			// trans: <div onclick="x">
			// '@' at 5 becomes 'on', so chars after shift +1

			expect(t.toTransformed(0)).toBe(0);   // '<'
			expect(t.toTransformed(4)).toBe(4);   // ' '
			expect(t.toTransformed(6)).toBe(7);   // 'c' → after 'on'
		});

		it('should accumulate shifts for mixed bindings', () => {
			const html = '<div .a="1" @b="2">';
			const t = createLitTransform(html);
			// orig:  <div .a="1" @b="2">
			// trans: <div a="1" onb="2">
			// '.' at 5: -1 shift, '@' at 12: +1 shift → cumulative 0

			// After first binding (shift -1)
			expect(t.toTransformed(6)).toBe(5); // 'a'
			// After second binding (shift -1 + 1 = 0)
			expect(t.toTransformed(13)).toBe(13); // 'b'
		});
	});

	describe('offset conversion — toOriginal', () => {
		it('should map offsets before the first binding unchanged', () => {
			const html = '<div .value="x">';
			const t = createLitTransform(html);

			expect(t.toOriginal(0)).toBe(0);
			expect(t.toOriginal(4)).toBe(4);
		});

		it('should reverse the shift after a removed prefix', () => {
			const html = '<div .value="x">';
			const t = createLitTransform(html);
			// trans[5] = 'v' → orig[6] = 'v'

			expect(t.toOriginal(5)).toBe(6);
			expect(t.toOriginal(10)).toBe(11);
		});

		it('should handle @event which grew', () => {
			const html = '<div @click="x">';
			const t = createLitTransform(html);
			// trans: <div onclick="x">
			// trans[7] = 'c' → orig[6] = 'c'

			expect(t.toOriginal(7)).toBe(6);
		});

		it('should roundtrip original → transformed → original', () => {
			const html = '<div .value=__ph_0__ @click=__ph_1__>';
			const t = createLitTransform(html);

			for (const offset of [ 0, 3, 6, 10, 20, 30 ]) {
				const transformed = t.toTransformed(offset);
				const backToOrig = t.toOriginal(transformed);
				expect(backToOrig).toBe(offset);
			}
		});
	});

	describe('edge cases', () => {
		it('should not match bindings without preceding whitespace', () => {
			const html = '<div>a.b=c</div>';
			const t = createLitTransform(html);

			expect(t.text).toBe(html);
			expect(t.bindings).toHaveLength(0);
		});

		it('should handle hyphenated attribute names', () => {
			const html = '<my-el .my-prop="x">';
			const t = createLitTransform(html);

			expect(t.text).toBe('<my-el my-prop="x">');
			expect(t.bindings[0]!.name).toBe('my-prop');
		});

		it('should handle binding at start of text', () => {
			const html = '.value="x"';
			const t = createLitTransform(html);

			// At position 0, no preceding whitespace — should NOT match
			expect(t.bindings).toHaveLength(0);
		});

		it('should handle empty text', () => {
			const t = createLitTransform('');

			expect(t.text).toBe('');
			expect(t.bindings).toHaveLength(0);
		});
	});
});
