/** @license Copyright 2024 Google LLC SPDX-License-Identifier: BSD-3-Clause */

import { MATHML_RESULT, type MATHMLResult } from '../constants.js';
import { directive, type DirectiveFn } from './directive.js';
import { UnsafeHTMLDirective } from './unsafe-html.js';


export class UnsafeMathMLDirective extends UnsafeHTMLDirective {

	static override directiveName = 'unsafeMath';
	static override resultType: MATHMLResult = MATHML_RESULT;

}


/**
 * Renders the result as MathML, rather than text.
 *
 * The values `undefined`, `null`, and `nothing`, will all result in no content
 * (empty string) being rendered.
 *
 * Note, this is unsafe to use with any user-provided input that hasn't been
 * sanitized or escaped, as it may lead to cross-site-scripting
 * vulnerabilities.
 */
export const unsafeMathML: DirectiveFn<typeof UnsafeMathMLDirective> = directive(UnsafeMathMLDirective);
