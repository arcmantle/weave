/** @license Copyright 2017 Google LLC SPDX-License-Identifier: BSD-3-Clause */

import { HTML_RESULT, type HTMLResult, noChange, nothing } from '../constants.ts';
import type { TemplateResult } from '../parts/types.ts';
import { Directive, directive, type DirectiveFn, type PartInfo, PartType } from './directive.ts';


export class UnsafeHTMLDirective extends Directive {

	declare ['constructor']: typeof UnsafeHTMLDirective;
	constructor(partInfo: PartInfo) {
		super(partInfo);

		if (partInfo.type !== PartType.CHILD) {
			throw new Error(''
			+ this.constructor.directiveName
			+ '() can only be used in child bindings');
		}
	}

	static directiveName = 'unsafeHTML';
	static resultType: HTMLResult = HTML_RESULT;

	private _value:           unknown = nothing;
	private _templateResult?: TemplateResult;

	render(value: string | typeof nothing | typeof noChange | undefined | null): unknown {
		if (value === nothing || value == null) {
			this._templateResult = undefined;

			return (this._value = value);
		}

		if (value === noChange)
			return value;

		if (typeof value != 'string') {
			throw new Error(''
			+ this.constructor.directiveName
			+ '() called with a non-string value');
		}

		if (value === this._value)
			return this._templateResult;

		this._value = value;

		const strings = [ value ] as unknown as TemplateStringsArray;
		(strings as any as { raw: TemplateStringsArray; }).raw = strings;

		// WARNING: impersonating a TemplateResult like this is extremely
		// dangerous. Third-party directives should not do this.
		this._templateResult = {
			// Cast to a known set of integers that satisfy ResultType so that we
			// don't have to export ResultType and possibly encourage this pattern.
			// This property needs to remain unminified.
			['_$litType$']: this.constructor.resultType,
			strings,
			values:         [],
		};

		return this._templateResult;
	}

}


/**
 * Renders the result as HTML, rather than text.
 *
 * The values `undefined`, `null`, and `nothing`, will all result in no content
 * (empty string) being rendered.
 *
 * Note, this is unsafe to use with any user-provided input that hasn't been
 * sanitized or escaped, as it may lead to cross-site-scripting
 * vulnerabilities.
 */
export const unsafeHTML: DirectiveFn<typeof UnsafeHTMLDirective> = directive(UnsafeHTMLDirective);
