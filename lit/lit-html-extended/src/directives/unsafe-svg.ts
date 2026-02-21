/** @license Copyright 2017 Google LLC SPDX-License-Identifier: BSD-3-Clause */

import { SVG_RESULT, type SVGResult } from '../constants.js';
import { directive, type DirectiveFn } from './directive.js';
import { UnsafeHTMLDirective } from './unsafe-html.js';


export class UnsafeSVGDirective extends UnsafeHTMLDirective {

	static override directiveName = 'unsafeSVG';
	static override resultType: SVGResult = SVG_RESULT;

}


/**
 * Renders the result as SVG, rather than text.
 *
 * The values `undefined`, `null`, and `nothing`, will all result in no content
 * (empty string) being rendered.
 *
 * Note, this is unsafe to use with any user-provided input that hasn't been
 * sanitized or escaped, as it may lead to cross-site-scripting
 * vulnerabilities.
 */
export const unsafeSVG: DirectiveFn<typeof UnsafeSVGDirective> = directive(UnsafeSVGDirective);
