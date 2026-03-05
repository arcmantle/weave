//
// CSS Region Detector
//
// Detects CSS regions inside TypeScript/JavaScript files by scanning for:
// 1. Tagged template expressions where the tag name matches configured names (default: css)
// 2. Template literals preceded by a comment marker like  /* css */
//
// Uses the TypeScript compiler API for robust AST-based detection.
//
import * as ts from 'typescript';


/** A detected CSS region within a source file. */
export interface CSSRegion {
	/** 0-based start offset of the CSS content (after the opening backtick). */
	start: number;
	/** 0-based end offset of the CSS content (before the closing backtick). */
	end: number;
	/** The raw CSS text (with interpolation expressions replaced by placeholders). */
	cssText: string;
	/**
	 * Maps from virtual CSS document offset to source file offset.
	 * Each entry is [virtualStart, virtualEnd, sourceStart, sourceEnd].
	 */
	mappings: OffsetMapping[];
	/** Ranges in the virtual CSS that are placeholders for interpolations. */
	placeholders: PlaceholderRange[];
}

export interface OffsetMapping {
	virtualStart: number;
	virtualEnd: number;
	sourceStart: number;
	sourceEnd: number;
}

export interface PlaceholderRange {
	virtualStart: number;
	virtualEnd: number;
}


export interface DetectorOptions {
	/** Tag function names to match (case-insensitive). Default: ['css'] */
	tagNames: string[];
	/** Comment body markers. Default: ['css'] */
	commentMarkers: string[];
}

const defaultOptions: DetectorOptions = {
	tagNames:       ['css'],
	commentMarkers: ['css'],
};


/**
 * Detects all CSS template literal regions in the given source text.
 */
export function detectCSSRegions(
	sourceText: string,
	fileName: string,
	options: Partial<DetectorOptions> = {},
): CSSRegion[] {
	const opts = { ...defaultOptions, ...options };
	const tagNamesLower = new Set(opts.tagNames.map(n => n.toLowerCase()));
	const markerBodies = new Set(opts.commentMarkers.map(m => m.toLowerCase().trim()));

	const scriptKind = getScriptKind(fileName);
	const sourceFile = ts.createSourceFile(
		fileName,
		sourceText,
		ts.ScriptTarget.Latest,
		/* setParentNodes */ true,
		scriptKind,
	);

	const regions: CSSRegion[] = [];

	function visit(node: ts.Node): void {
		// Case 1: Tagged template expression  (e.g. css tag)
		if (ts.isTaggedTemplateExpression(node)) {
			const tagName = extractTagName(node.tag);
			if (tagName && tagNamesLower.has(tagName.toLowerCase())) {
				const region = extractRegion(node.template, sourceText);
				if (region)
					regions.push(region);

				// Don't recurse into the template itself again
				ts.forEachChild(node.tag, visit);

				return;
			}
		}

		// Case 2: Untagged template literal with leading /*css*/ comment
		if (
			(ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node))
			&& !ts.isTaggedTemplateExpression(node.parent)
		) {
			if (hasLeadingCSSComment(node, sourceText, markerBodies)) {
				const region = extractRegion(node, sourceText);
				if (region)
					regions.push(region);

				return;
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);

	return regions;
}


/** Extract the tag identifier name from a tag expression. */
function extractTagName(tag: ts.Expression): string | undefined {
	if (ts.isIdentifier(tag))
		return tag.text;

	// Support property access like LitElement.css (take the last part)
	if (ts.isPropertyAccessExpression(tag))
		return tag.name.text;

	return undefined;
}


/** Determine TypeScript ScriptKind from file extension. */
function getScriptKind(fileName: string): ts.ScriptKind {
	const lower = fileName.toLowerCase();
	if (lower.endsWith('.tsx'))
		return ts.ScriptKind.TSX;
	if (lower.endsWith('.jsx'))
		return ts.ScriptKind.JSX;
	if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs'))
		return ts.ScriptKind.JS;

	return ts.ScriptKind.TS;
}


// Checks whether the given node has a leading comment whose body matches
// one of the CSS markers (e.g. css).
// Supports block comments, JSDoc comments, and line comments.
// Uses backward scanning from the template literal start because
// TypeScript's getLeadingCommentRanges only works for comments
// at line/file boundaries, not for mid-expression comments.
function hasLeadingCSSComment(
	node: ts.Node,
	sourceText: string,
	markers: Set<string>,
): boolean {
	const start = node.getStart();

	// Scan backward from the template literal start, skipping whitespace
	let pos = start - 1;
	while (pos >= 0 && (sourceText[pos] === ' ' || sourceText[pos] === '\t' || sourceText[pos] === '\n' || sourceText[pos] === '\r'))
		pos--;

	if (pos < 1)
		return false;

	// Check for block comment ending: */
	if (sourceText[pos] === '/' && sourceText[pos - 1] === '*') {
		// Scan backward to find the opening /*
		const commentEnd = pos + 1;
		let commentStart = pos - 2;
		while (commentStart >= 0) {
			if (sourceText[commentStart] === '/' && sourceText[commentStart + 1] === '*')
				break;

			commentStart--;
		}

		if (commentStart < 0)
			return false;

		const commentText = sourceText.slice(commentStart, commentEnd);
		const body = extractCommentBody(commentText);

		return markers.has(body.toLowerCase());
	}

	// Check for line comment: // css (scan backward to find //)
	// The line comment must be on the line directly before or same line
	const lineStart = sourceText.lastIndexOf('\n', start - 1);
	const lineContent = sourceText.slice(lineStart + 1, start);
	const lineCommentMatch = lineContent.match(/\/\/\s*(\S+)\s*$/);
	if (lineCommentMatch) {
		const body = lineCommentMatch[1]!.toLowerCase().replace(/[*?]/g, '').trim();

		return markers.has(body);
	}

	return false;
}


/**
 * Extracts the body text from a comment, stripping comment syntax.
 * Handles block comments, JSDoc comments, and line comments.
 */
function extractCommentBody(comment: string): string {
	let body = comment;

	// Block comment
	if (body.startsWith('/*') && body.endsWith('*/')) {
		body = body.slice(2, -2);
	}
	// Line comment
	else if (body.startsWith('//')) {
		body = body.slice(2);
	}

	// Strip leading star and question-mark characters
	body = body.replace(/^[\s*?]+/, '').replace(/[\s*?]+$/, '');

	return body.trim();
}


/**
 * Extracts a CSSRegion from a template literal node,
 * handling interpolations by inserting CSS-valid placeholders.
 */
function extractRegion(
	template: ts.TemplateLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression,
	sourceText: string,
): CSSRegion | undefined {
	if (ts.isNoSubstitutionTemplateLiteral(template)) {
		// Simple case: no interpolations
		const start = template.getStart() + 1; // skip opening backtick
		const end = template.getEnd() - 1;     // skip closing backtick
		const cssText = sourceText.slice(start, end);

		if (!cssText.trim())
			return undefined;

		return {
			start,
			end,
			cssText,
			mappings: [{
				virtualStart: 0,
				virtualEnd:   cssText.length,
				sourceStart:  start,
				sourceEnd:    end,
			}],
			placeholders: [],
		};
	}

	if (ts.isTemplateExpression(template)) {
		return extractInterpolatedRegion(template, sourceText);
	}

	return undefined;
}


/**
 * Handles template expressions with interpolations.
 *
 * Strategy: replace each interpolation with a CSS-parseable placeholder
 * that preserves the structural validity of the CSS.
 * Uses CSS custom property values like var(--_ph_N) as placeholders.
 */
function extractInterpolatedRegion(
	template: ts.TemplateExpression,
	sourceText: string,
): CSSRegion | undefined {
	const mappings: OffsetMapping[] = [];
	const placeholders: PlaceholderRange[] = [];
	let cssText = '';
	let virtualOffset = 0;

	// Process the head
	const headStart = template.head.getStart() + 1; // skip backtick
	const headEnd = template.head.getEnd() - 2;     // skip interpolation opening
	const headText = sourceText.slice(headStart, headEnd);

	mappings.push({
		virtualStart: virtualOffset,
		virtualEnd:   virtualOffset + headText.length,
		sourceStart:  headStart,
		sourceEnd:    headEnd,
	});
	cssText += headText;
	virtualOffset += headText.length;

	// Process each template span (expression + literal)
	for (let i = 0; i < template.templateSpans.length; i++) {
		const span = template.templateSpans[i]!;

		// Insert placeholder for the expression
		const placeholder = `var(--_ph_${i})`;
		placeholders.push({
			virtualStart: virtualOffset,
			virtualEnd:   virtualOffset + placeholder.length,
		});
		cssText += placeholder;
		virtualOffset += placeholder.length;

		// Process the literal part after the expression
		const literal = span.literal;
		const litStart = literal.getStart() + 1; // skip `}`
		const litEnd = literal.getEnd() - (ts.isTemplateMiddle(literal) ? 2 : 1); // skip interpolation opening or backtick

		const litText = sourceText.slice(litStart, litEnd);

		if (litText.length > 0) {
			mappings.push({
				virtualStart: virtualOffset,
				virtualEnd:   virtualOffset + litText.length,
				sourceStart:  litStart,
				sourceEnd:    litEnd,
			});
			cssText += litText;
			virtualOffset += litText.length;
		}
	}

	if (!cssText.trim())
		return undefined;

	const regionStart = template.head.getStart() + 1;
	const regionEnd = template.templateSpans[template.templateSpans.length - 1]!.literal.getEnd() - 1;

	return {
		start: regionStart,
		end:   regionEnd,
		cssText,
		mappings,
		placeholders,
	};
}
