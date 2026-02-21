/** @license Copyright 2020 Google LLC SPDX-License-Identifier: BSD-3-Clause */

import { noChange } from '../constants.ts';
import { Directive, directive, type DirectiveFn, type PartInfo, PartType } from './directive.ts';


export class TemplateContentDirective extends Directive {

	private _previousTemplate?: HTMLTemplateElement;

	constructor(partInfo: PartInfo) {
		super(partInfo);
		if (partInfo.type !== PartType.CHILD)
			throw new Error('templateContent can only be used in child bindings');
	}

	render(template: HTMLTemplateElement): unknown {
		if (this._previousTemplate === template)
			return noChange;

		this._previousTemplate = template;

		return document.importNode(template.content, true);
	}

}


/**
 * Renders the content of a template element as HTML.
 *
 * Note, the template should be developer controlled and not user controlled.
 * Rendering a user-controlled template with this directive
 * could lead to cross-site-scripting vulnerabilities.
 */
export const templateContent: DirectiveFn<typeof TemplateContentDirective> = directive(TemplateContentDirective);
