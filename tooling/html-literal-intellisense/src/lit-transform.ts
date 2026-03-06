/**
 * Lit Transform
 *
 * Transforms Lit-specific attribute binding prefixes (`.`, `?`, `@`) in
 * virtual HTML text so the standard HTML language service can process it.
 * - `.prop=` → `prop=`   (strip dot)
 * - `?attr=` → `attr=`   (strip question mark)
 * - `@event=` → `onevent=` (replace @ with "on")
 *
 * Provides bidirectional offset conversion between original and transformed text.
 */


export type LitBindingKind = 'property' | 'boolean' | 'event';

export interface LitBindingInfo {
	kind:          LitBindingKind;
	/** The attribute/event name without prefix (e.g. "value", "disabled", "click"). */
	name:          string;
	/** Offset in the original htmlText where the prefix char starts. */
	originalStart: number;
}

export interface LitTransform {
	/** The transformed HTML text with Lit prefixes resolved. */
	text:     string;
	/** Metadata about each Lit binding found and transformed. */
	bindings: LitBindingInfo[];
	/** Convert an offset in the original htmlText to an offset in the transformed text. */
	toTransformed(originalOffset: number): number;
	/** Convert an offset in the transformed text back to an offset in the original htmlText. */
	toOriginal(transformedOffset: number): number;
}


/** Regex matching `.attr=`, `?attr=`, `@event=` Lit binding prefixes. */
const LIT_BINDING_RE = /([.?@])([-\w]+)\s*=/g;


/** A single replacement operation in the original text. */
interface Replacement {
	/** Start offset in original text. */
	start:   number;
	/** Number of chars removed from original. */
	oldLen:  number;
	/** Text inserted into transformed output. */
	newText: string;
}


/**
 * Creates a Lit transform for the given HTML text.
 * Transforms `.`, `?`, `@` attribute binding prefixes so the HTML language
 * service sees standard attribute names and can provide useful completions/hover.
 */
export function createLitTransform(htmlText: string): LitTransform {
	const replacements: Replacement[] = [];
	const bindings: LitBindingInfo[] = [];

	let match: RegExpExecArray | null;
	LIT_BINDING_RE.lastIndex = 0;

	while ((match = LIT_BINDING_RE.exec(htmlText)) !== null) {
		if (match.index === 0 || !/\s/.test(htmlText[match.index - 1]!))
			continue;

		const prefix = match[1]!;
		const name = match[2]!;

		bindings.push({
			kind: prefix === '.' ? 'property'
				: prefix === '?' ? 'boolean'
					: 'event',
			name,
			originalStart: match.index,
		});

		if (prefix === '@') {
			// Replace '@' (1 char) with 'on' (2 chars)
			replacements.push({ start: match.index, oldLen: 1, newText: 'on' });
		}
		else {
			// Remove '.' or '?' (1 char) entirely
			replacements.push({ start: match.index, oldLen: 1, newText: '' });
		}
	}

	if (replacements.length === 0) {
		return {
			text:          htmlText,
			bindings:      [],
			toTransformed: (offset: number) => offset,
			toOriginal:    (offset: number) => offset,
		};
	}

	// Build transformed text
	let text = '';
	let last = 0;
	for (const r of replacements) {
		text += htmlText.slice(last, r.start);
		text += r.newText;
		last = r.start + r.oldLen;
	}
	text += htmlText.slice(last);

	// Pre-compute cumulative shifts for fast offset conversion.
	// shift = newText.length - oldLen for each replacement.
	// Positive shift = text grew, negative = text shrank.
	const shiftEntries: { pos: number; origEnd: number; totalShift: number; }[] = [];
	let totalShift = 0;
	for (const r of replacements) {
		totalShift += r.newText.length - r.oldLen;
		shiftEntries.push({ pos: r.start, origEnd: r.start + r.oldLen, totalShift });
	}

	return {
		text,
		bindings,

		toTransformed(originalOffset: number): number {
			let shift = 0;
			for (const entry of shiftEntries) {
				if (entry.pos < originalOffset)
					shift = entry.totalShift;
				else
					break;
			}

			return originalOffset + shift;
		},

		toOriginal(transformedOffset: number): number {
			let shift = 0;
			for (const entry of shiftEntries) {
				// transEnd = origEnd + totalShift (end of replacement in transformed space)
				if (entry.origEnd + entry.totalShift <= transformedOffset)
					shift = entry.totalShift;
				else
					break;
			}

			return transformedOffset - shift;
		},
	};
}


export type LitPrefix = '.' | '?' | '@';

/**
 * Detect whether the cursor is positioned after a Lit binding prefix.
 * Scans backward through attribute-name chars, then checks for `.`, `?`, or `@`
 * preceded by whitespace (tag attribute context).
 */
export function detectLitPrefix(htmlText: string, virtualOffset: number): LitPrefix | null {
	let pos = virtualOffset - 1;

	// Skip backward through attribute-name characters
	while (pos >= 0 && /[-\w]/.test(htmlText[pos]!))
		pos--;

	if (pos < 0)
		return null;

	const char = htmlText[pos]!;
	if (char !== '.' && char !== '?' && char !== '@')
		return null;

	// Verify preceding whitespace (we're in attribute position, not content)
	if (pos === 0 || !/\s/.test(htmlText[pos - 1]!))
		return null;

	return char as LitPrefix;
}
