//
// HTML Region Detector
//
// Detects HTML regions inside TypeScript/JavaScript files by scanning for:
// 1. Tagged template expressions where the tag name matches configured names (default: html)
// 2. Template literals preceded by a comment marker like  /* html */
//
// Uses the TypeScript compiler API for robust AST-based detection.
//
import * as ts from 'typescript';


/** A detected HTML region within a source file. */
export interface HTMLRegion {
	/** Whether this region contains HTML or CSS content. */
	kind:         'html' | 'css';
	/** 0-based start offset of the HTML content (after the opening backtick). */
	start:        number;
	/** 0-based end offset of the HTML content (before the closing backtick). */
	end:          number;
	/** The raw HTML text (with interpolation expressions replaced by placeholders). */
	htmlText:     string;
	/**
	 * Maps from virtual HTML document offset to source file offset.
	 * Each entry is [virtualStart, virtualEnd, sourceStart, sourceEnd].
	 */
	mappings:     OffsetMapping[];
	/** Ranges in the virtual HTML that are placeholders for interpolations. */
	placeholders: PlaceholderRange[];
}

export interface OffsetMapping {
	virtualStart: number;
	virtualEnd:   number;
	sourceStart:  number;
	sourceEnd:    number;
}

export interface PlaceholderRange {
	virtualStart: number;
	virtualEnd:   number;
}


export interface DetectorOptions {
	/** Tag function names to match (case-insensitive). Default: ['html'] */
	tagNames:         string[];
	/** Comment body markers. Default: ['html'] */
	commentMarkers:   string[];
	/** Tag function names to treat as CSS template literals. Default: ['css'] */
	cssTagNames:      string[];
	/** Comment markers for CSS template literals. Default: ['css'] */
	cssCommentMarkers: string[];
}

const defaultOptions: DetectorOptions = {
	tagNames:          [ 'html' ],
	commentMarkers:    [ 'html' ],
	cssTagNames:       [ 'css' ],
	cssCommentMarkers: [ 'css' ],
};


/**
 * Detects all HTML template literal regions in the given source text.
 */
export function detectHTMLRegions(
	sourceText: string,
	fileName: string,
	options: Partial<DetectorOptions> = {},
): HTMLRegion[] {
	const opts = { ...defaultOptions, ...options };
	const tagNamesLower = new Set(opts.tagNames.map(n => n.toLowerCase()));
	const markerBodies = new Set(opts.commentMarkers.map(m => m.toLowerCase().trim()));
	const cssTagNamesLower = new Set(opts.cssTagNames.map(n => n.toLowerCase()));
	const cssMarkerBodies = new Set(opts.cssCommentMarkers.map(m => m.toLowerCase().trim()));

	const scriptKind = getScriptKind(fileName);
	const sourceFile = ts.createSourceFile(
		fileName,
		sourceText,
		ts.ScriptTarget.Latest,
		/* setParentNodes */ true,
		scriptKind,
	);

	const regions: HTMLRegion[] = [];

	function visit(node: ts.Node): void {
		// Case 1: Tagged template expression  (e.g. html or css tag)
		if (ts.isTaggedTemplateExpression(node)) {
			const tagName = extractTagName(node.tag);
			if (tagName) {
				const nameLower = tagName.toLowerCase();
				const isHTMLTag = tagNamesLower.has(nameLower);
				const isCSSTag = cssTagNamesLower.has(nameLower);

				if (isHTMLTag || isCSSTag) {
					const region = extractRegion(node.template, sourceText);
					if (region)
						regions.push(isCSSTag ? wrapCSSRegion(region) : region);

					// Recurse into tag expression
					ts.forEachChild(node.tag, visit);

					// Recurse into interpolation expressions to find nested blocks
					const template = node.template;
					if (ts.isTemplateExpression(template)) {
						for (const span of template.templateSpans)
							visit(span.expression);
					}

					return;
				}
			}
		}

		// Case 2: Untagged template literal with leading /*html*/ or /*css*/ comment
		if (
			(ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node))
			&& !ts.isTaggedTemplateExpression(node.parent)
		) {
			const isHTMLComment = hasLeadingHTMLComment(node, sourceText, markerBodies);
			const isCSSComment = !isHTMLComment && hasLeadingHTMLComment(node, sourceText, cssMarkerBodies);

			if (isHTMLComment || isCSSComment) {
				const region = extractRegion(node, sourceText);
				if (region)
					regions.push(isCSSComment ? wrapCSSRegion(region) : region);

				// Recurse into interpolation expressions for nested templates
				if (ts.isTemplateExpression(node)) {
					for (const span of node.templateSpans)
						visit(span.expression);
				}

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

	// Support property access like LitElement.html (take the last part)
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
// one of the HTML markers (e.g. html).
// Supports block comments, JSDoc comments, and line comments.
function hasLeadingHTMLComment(
	node: ts.Node,
	sourceText: string,
	markers: Set<string>,
): boolean {
	const start = node.getStart();

	// Scan backward from the template literal start, skipping whitespace
	let pos = start - 1;
	while (
		pos >= 0 && (
			sourceText[pos] === ' '
			|| sourceText[pos] === '\t'
			|| sourceText[pos] === '\n'
			|| sourceText[pos] === '\r'
		)
	)
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

	// Check for line comment: // html (scan backward to find //)
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
	if (body.startsWith('/*') && body.endsWith('*/'))
		body = body.slice(2, -2);

	// Line comment
	else if (body.startsWith('//'))
		body = body.slice(2);


	// Strip leading star and question-mark characters
	body = body.replace(/^[\s*?]+/, '').replace(/[\s*?]+$/, '');

	return body.trim();
}


/**
 * Extracts an HTMLRegion from a template literal node,
 * handling interpolations by inserting HTML-valid placeholders.
 */
function extractRegion(
	template: ts.TemplateLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression,
	sourceText: string,
): HTMLRegion | undefined {
	if (ts.isNoSubstitutionTemplateLiteral(template)) {
		// Simple case: no interpolations
		const start = template.getStart() + 1; // skip opening backtick
		const end = template.getEnd() - 1;     // skip closing backtick
		const htmlText = sourceText.slice(start, end);

		if (!htmlText.trim())
			return undefined;

		return {
			kind: 'html',
			start,
			end,
			htmlText,
			mappings: [
				{
					virtualStart: 0,
					virtualEnd:   htmlText.length,
					sourceStart:  start,
					sourceEnd:    end,
				},
			],
			placeholders: [],
		};
	}

	if (ts.isTemplateExpression(template))
		return extractInterpolatedRegion(template, sourceText);


	return undefined;
}


/**
 * Handles template expressions with interpolations.
 *
 * Strategy: replace each interpolation with an HTML-parseable placeholder.
 * Uses __ph_N__ as placeholders, which are valid in both attribute value
 * and content contexts without breaking HTML parsing.
 */
function extractInterpolatedRegion(
	template: ts.TemplateExpression,
	sourceText: string,
): HTMLRegion | undefined {
	const mappings: OffsetMapping[] = [];
	const placeholders: PlaceholderRange[] = [];
	let htmlText = '';
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
	htmlText += headText;
	virtualOffset += headText.length;

	// Process each template span (expression + literal)
	for (let i = 0; i < template.templateSpans.length; i++) {
		const span = template.templateSpans[i]!;

		// Insert placeholder for the expression
		const placeholder = `__ph_${ i }__`;
		placeholders.push({
			virtualStart: virtualOffset,
			virtualEnd:   virtualOffset + placeholder.length,
		});
		htmlText += placeholder;
		virtualOffset += placeholder.length;

		// Process the literal part after the expression
		const literal = span.literal;
		const litStart = literal.getStart() + 1; // skip `}`
		// skip interpolation opening or backtick
		const litEnd = literal.getEnd() - (ts.isTemplateMiddle(literal) ? 2 : 1);

		const litText = sourceText.slice(litStart, litEnd);

		if (litText.length > 0) {
			mappings.push({
				virtualStart: virtualOffset,
				virtualEnd:   virtualOffset + litText.length,
				sourceStart:  litStart,
				sourceEnd:    litEnd,
			});
			htmlText += litText;
			virtualOffset += litText.length;
		}
	}

	if (!htmlText.trim())
		return undefined;

	const regionStart = template.head.getStart() + 1;
	const regionEnd = template.templateSpans[template.templateSpans.length - 1]!.literal.getEnd() - 1;

	return {
		kind: 'html',
		start: regionStart,
		end:   regionEnd,
		htmlText,
		mappings,
		placeholders,
	};
}


const CSS_WRAPPER_PREFIX = '<style>';
const CSS_WRAPPER_SUFFIX = '</style>';

/**
 * Wraps a raw CSS region in <style> tags so the HTML language service
 * provides CSS intellisense. Shifts all virtual offsets accordingly.
 */
function wrapCSSRegion(region: HTMLRegion): HTMLRegion {
	const shift = CSS_WRAPPER_PREFIX.length;

	return {
		kind:         'css',
		start:        region.start,
		end:          region.end,
		htmlText:     CSS_WRAPPER_PREFIX + region.htmlText + CSS_WRAPPER_SUFFIX,
		mappings:     region.mappings.map(m => ({
			virtualStart: m.virtualStart + shift,
			virtualEnd:   m.virtualEnd + shift,
			sourceStart:  m.sourceStart,
			sourceEnd:    m.sourceEnd,
		})),
		placeholders: region.placeholders.map(p => ({
			virtualStart: p.virtualStart + shift,
			virtualEnd:   p.virtualEnd + shift,
		})),
	};
}
