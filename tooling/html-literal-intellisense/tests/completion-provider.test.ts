import { describe, expect, it } from 'vitest';

import { detectLitPrefix } from '../src/lit-transform';


describe('detectLitPrefix', () => {
	describe('property binding (.)', () => {
		it('should detect . prefix with attribute name', () => {
			//       0123456789012
			const h = '<div .value=';
			expect(detectLitPrefix(h, 11)).toBe('.'); // cursor after 'e' in 'value'
		});

		it('should detect . prefix with partial attribute name', () => {
			const h = '<div .va';
			expect(detectLitPrefix(h, 8)).toBe('.'); // cursor after 'a'
		});

		it('should detect . prefix with cursor right after dot', () => {
			const h = '<div .';
			expect(detectLitPrefix(h, 6)).toBe('.'); // cursor right after '.'
		});
	});

	describe('boolean binding (?)', () => {
		it('should detect ? prefix with attribute name', () => {
			const h = '<button ?disabled=';
			expect(detectLitPrefix(h, 17)).toBe('?');
		});

		it('should detect ? prefix with cursor right after ?', () => {
			const h = '<button ?';
			expect(detectLitPrefix(h, 9)).toBe('?');
		});
	});

	describe('event binding (@)', () => {
		it('should detect @ prefix with event name', () => {
			const h = '<button @click=';
			expect(detectLitPrefix(h, 14)).toBe('@');
		});

		it('should detect @ prefix with partial name', () => {
			const h = '<button @cl';
			expect(detectLitPrefix(h, 11)).toBe('@');
		});
	});

	describe('non-binding contexts', () => {
		it('should return null for regular attributes', () => {
			const h = '<div class="foo">';
			expect(detectLitPrefix(h, 10)).toBeNull();
		});

		it('should return null when prefix lacks preceding whitespace', () => {
			const h = '<div>text.value=';
			expect(detectLitPrefix(h, 15)).toBeNull();
		});

		it('should return null at start of string', () => {
			const h = '.value=';
			expect(detectLitPrefix(h, 6)).toBeNull();
		});

		it('should return null for empty string', () => {
			expect(detectLitPrefix('', 0)).toBeNull();
		});

		it('should return null for content text with ?', () => {
			const h = '<div>is this?real';
			expect(detectLitPrefix(h, 17)).toBeNull();
		});

		it('should return null for @ in content without whitespace', () => {
			const h = '<div>user@email';
			expect(detectLitPrefix(h, 15)).toBeNull();
		});
	});

	describe('edge cases', () => {
		it('should detect prefix with hyphenated attribute name', () => {
			const h = '<my-el .my-prop=';
			expect(detectLitPrefix(h, 15)).toBe('.');
		});

		it('should not detect prefix when = is right before cursor', () => {
			// This simulates attribute VALUE context, but detectLitPrefix
			// only scans backward through [-\w] chars, so = stops it
			const h = '<div @click=';
			expect(detectLitPrefix(h, 12)).toBeNull(); // cursor after '='
		});

		it('should handle prefix after newline whitespace', () => {
			const h = '<div\n\t.value=';
			expect(detectLitPrefix(h, 12)).toBe('.');
		});
	});
});
