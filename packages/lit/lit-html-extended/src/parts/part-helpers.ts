import type { TrustedHTML } from 'trusted-types/lib/index';

import { ATTRIBUTE_NAME, boundAttributeSuffix, COMMENT_START, comment2EndRegex, commentEndRegex, DEV_MODE, doubleQuoteAttrEndRegex, DYNAMIC_TAG_NAME, ENTIRE_MATCH, marker, MATHML_RESULT, nodeMarker, QUOTE_CHAR, rawTextElement, type ResultType, singleQuoteAttrEndRegex, SPACES_AND_EQUALS, SVG_RESULT, TAG_NAME, tagEndRegex, textEndRegex } from '../constants.ts';
import { trustFromTemplateString } from '../security.ts';


/**
 * Returns an HTML string for the given TemplateStringsArray and result type
 * (HTML or SVG), along with the case-sensitive bound attribute names in
 * template order. The HTML contains comment markers denoting the `ChildPart`s
 * and suffixes on bound attributes denoting the `AttributeParts`.
 *
 * @param strings template strings array
 * @param type HTML or SVG
 * @return Array containing `[html, attrNames]`
 * (array returned for terseness, to avoid object fields since this code is shared with non-minified SSR code)
 */
export const getTemplateHtml = (
	strings: TemplateStringsArray,
	type: ResultType,
): [TrustedHTML, string[]] => {
	// Insert makers into the template HTML to represent the position of
	// bindings. The following code scans the template strings to determine the
	// syntactic position of the bindings. They can be in text position, where
	// we insert an HTML comment, attribute value position, where we insert a
	// sentinel string and re-write the attribute name, or inside a tag where
	// we insert the sentinel string.
	const l = strings.length - 1;

	// Stores the case-sensitive bound attribute names in the order of their
	// parts. ElementParts are also reflected in this array as undefined
	// rather than a string, to disambiguate from attribute bindings.
	const attrNames: string[] = [];

	// When we're inside a raw text tag (not it's text content), the regex
	// will still be tagRegex so we can find attributes, but will switch to
	// this regex when the tag ends.
	let rawTextEndRegex: RegExp | undefined;

	// The current parsing state, represented as a reference to one of the regexes
	let regex = textEndRegex;

	let html = type === SVG_RESULT ? '<svg>'
		: type === MATHML_RESULT ? '<math>'
			: '';

	for (let i = 0; i < l; i++) {
		const s = strings[i]!;
		// The index of the end of the last attribute name. When this is
		// positive at end of a string, it means we're in an attribute value
		// position and need to rewrite the attribute name.
		// We also use a special value of -2 to indicate that we encountered
		// the end of a string in attribute name position.
		let attrNameEndIndex = -1;
		let attrName: string | undefined;
		let lastIndex = 0;
		let match!: RegExpExecArray | null;

		// The conditions in this loop handle the current parse state, and the
		// assignments to the `regex` variable are the state transitions.
		while (lastIndex < s.length) {
			// Make sure we start searching from where we previously left off
			regex.lastIndex = lastIndex;
			match = regex.exec(s);
			if (match === null)
				break;

			lastIndex = regex.lastIndex;
			if (regex === textEndRegex) {
				if (match[COMMENT_START] === '!--') {
					regex = commentEndRegex;
				}
				else if (match[COMMENT_START] !== undefined) {
					// We started a weird comment, like </{
					regex = comment2EndRegex;
				}
				else if (match[TAG_NAME] !== undefined) {
					if (rawTextElement.test(match[TAG_NAME])) {
						// Record if we encounter a raw-text element. We'll switch to
						// this regex at the end of the tag.
						rawTextEndRegex = new RegExp(`</${ match[TAG_NAME] }`, 'g');
					}

					regex = tagEndRegex;
				}
				else if (match[DYNAMIC_TAG_NAME] !== undefined) {
					if (DEV_MODE.value) {
						throw new Error(''
							+ 'Bindings in tag names are not supported. Please use static templates instead. '
							+ 'See https://lit.dev/docs/templates/expressions/#static-expressions');
					}

					regex = tagEndRegex;
				}
			}
			else if (regex === tagEndRegex) {
				if (match[ENTIRE_MATCH] === '>') {
					// End of a tag. If we had started a raw-text element, use that
					// regex
					regex = rawTextEndRegex ?? textEndRegex;
					// We may be ending an unquoted attribute value, so make sure we
					// clear any pending attrNameEndIndex
					attrNameEndIndex = -1;
				}
				else if (match[ATTRIBUTE_NAME] === undefined) {
					// Attribute name position
					attrNameEndIndex = -2;
				}
				else {
					attrNameEndIndex = regex.lastIndex - match[SPACES_AND_EQUALS]!.length;
					attrName = match[ATTRIBUTE_NAME];
					regex =
            match[QUOTE_CHAR] === undefined
            	? tagEndRegex
            	: match[QUOTE_CHAR] === '"'
            		? doubleQuoteAttrEndRegex
            		: singleQuoteAttrEndRegex;
				}
			}
			else if (
				regex === doubleQuoteAttrEndRegex ||
        regex === singleQuoteAttrEndRegex
			) {
				regex = tagEndRegex;
			}
			else if (regex === commentEndRegex || regex === comment2EndRegex) {
				regex = textEndRegex;
			}
			else {
				// Not one of the five state regexes, so it must be the dynamically
				// created raw text regex and we're at the close of that element.
				regex = tagEndRegex;
				rawTextEndRegex = undefined;
			}
		}

		if (DEV_MODE.value) {
			// If we have a attrNameEndIndex, which indicates that we should
			// rewrite the attribute name, assert that we're in a valid attribute
			// position - either in a tag, or a quoted attribute value.
			console.assert(
				attrNameEndIndex === -1 ||
          regex === tagEndRegex ||
          regex === singleQuoteAttrEndRegex ||
          regex === doubleQuoteAttrEndRegex,
				'unexpected parse state B',
			);
		}

		// We have four cases:
		//  1. We're in text position, and not in a raw text element
		//     (regex === textEndRegex): insert a comment marker.
		//  2. We have a non-negative attrNameEndIndex which means we need to
		//     rewrite the attribute name to add a bound attribute suffix.
		//  3. We're at the non-first binding in a multi-binding attribute, use a
		//     plain marker.
		//  4. We're somewhere else inside the tag. If we're in attribute name
		//     position (attrNameEndIndex === -2), add a sequential suffix to
		//     generate a unique attribute name.

		// Detect a binding next to self-closing tag end and insert a space to
		// separate the marker from the tag end:
		const end = regex === tagEndRegex && strings[i + 1]?.startsWith('/>')
			? ' '
			: '';

		let nextString = '';
		if (regex === textEndRegex) {
			nextString = s + nodeMarker;
		}
		else {
			if (attrNameEndIndex >= 0) {
				attrNames.push(attrName!);
				nextString = ''
					+ s.slice(0, attrNameEndIndex)
					+ boundAttributeSuffix
					+ s.slice(attrNameEndIndex)
					+ marker
					+ end;
			}
			else {
				nextString = s + marker + (attrNameEndIndex === -2 ? i : end);
			}
		}

		html += nextString;
	}

	const htmlResult: string | TrustedHTML = ''
	+ html
	+ (strings[l] || '<?>')
	+ (type === SVG_RESULT ? '</svg>' : type === MATHML_RESULT ? '</math>' : '');

	// Returned as an array for terseness
	return [ trustFromTemplateString(strings, htmlResult), attrNames ];
};
