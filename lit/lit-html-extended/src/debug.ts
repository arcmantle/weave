import { DEV_MODE } from './constants.ts';
import type { GlobalType } from './global-type.ts';
import type { ChildPart } from './parts/child-part.ts';
import type { Disconnectable } from './parts/disconnectable.ts';
import type { Part, Template, TemplateInstance, TemplatePart } from './parts/template.ts';
import type { CompiledTemplate, RenderOptions } from './parts/types.ts';


// Allows minifiers to rename references to globalThis
const global = globalThis as GlobalType;


/**
 * Contains types that are part of the unstable debug API.
 *
 * Everything in this API is not stable and may change or be removed in the future,
 * even on patch releases.
 */
export namespace LitUnstable {
	/**
	* When Lit is running in dev mode and `window.emitLitDebugLogEvents` is true,
	* we will emit 'lit-debug' events to window, with live details about the update and render
	* lifecycle. These can be useful for writing debug tooling and visualizations.
	*
	* Please be aware that running with window.emitLitDebugLogEvents has performance overhead,
	* making certain operations that are normally very cheap (like a no-op render) much slower,
	* because we must copy data and dispatch events.
	*/
	export namespace DebugLog {
		export type Entry =
		| TemplatePrep
		| TemplateInstantiated
		| TemplateInstantiatedAndUpdated
		| TemplateUpdating
		| BeginRender
		| EndRender
		| CommitPartEntry
		| SetPartValue;

		export interface TemplatePrep {
			kind:             'template prep';
			template:         Template;
			strings:          TemplateStringsArray;
			clonableTemplate: HTMLTemplateElement;
			parts:            TemplatePart[];
		}

		export interface BeginRender {
			kind:      'begin render';
			id:        number;
			value:     unknown;
			container: HTMLElement | DocumentFragment;
			options:   RenderOptions | undefined;
			part:      ChildPart | undefined;
		}

		export interface EndRender {
			kind:      'end render';
			id:        number;
			value:     unknown;
			container: HTMLElement | DocumentFragment;
			options:   RenderOptions | undefined;
			part:      ChildPart;
		}

		export interface TemplateInstantiated {
			kind:     'template instantiated';
			template: Template | CompiledTemplate;
			instance: TemplateInstance;
			options:  RenderOptions | undefined;
			fragment: Node;
			parts:    (Part | undefined)[];
			values:   unknown[];
		}

		export interface TemplateInstantiatedAndUpdated {
			kind:     'template instantiated and updated';
			template: Template | CompiledTemplate;
			instance: TemplateInstance;
			options:  RenderOptions | undefined;
			fragment: Node;
			parts:    (Part | undefined)[];
			values:   unknown[];
		}

		export interface TemplateUpdating {
			kind:     'template updating';
			template: Template | CompiledTemplate;
			instance: TemplateInstance;
			options:  RenderOptions | undefined;
			parts:    (Part | undefined)[];
			values:   unknown[];
		}

		export interface SetPartValue {
			kind:             'set part';
			part:             Part;
			value:            unknown;
			valueIndex:       number;
			values:           unknown[];
			templateInstance: TemplateInstance;
		}

		export type CommitPartEntry =
		| CommitNothingToChildEntry
		| CommitText
		| CommitNode
		| CommitAttribute
		| CommitProperty
		| CommitBooleanAttribute
		| CommitEventListener
		| CommitToElementBinding;

		export interface CommitNothingToChildEntry {
			kind:    'commit nothing to child';
			start:   ChildNode;
			end:     ChildNode | null;
			parent:  Disconnectable | undefined;
			options: RenderOptions | undefined;
		}

		export interface CommitText {
			kind:    'commit text';
			node:    Text;
			value:   unknown;
			options: RenderOptions | undefined;
		}

		export interface CommitNode {
			kind:    'commit node';
			start:   Node;
			parent:  Disconnectable | undefined;
			value:   Node;
			options: RenderOptions | undefined;
		}

		export interface CommitAttribute {
			kind:    'commit attribute';
			element: Element;
			name:    string;
			value:   unknown;
			options: RenderOptions | undefined;
		}

		export interface CommitProperty {
			kind:    'commit property';
			element: Element;
			name:    string;
			value:   unknown;
			options: RenderOptions | undefined;
		}

		export interface CommitBooleanAttribute {
			kind:    'commit boolean attribute';
			element: Element;
			name:    string;
			value:   boolean;
			options: RenderOptions | undefined;
		}

		export interface CommitEventListener {
			kind:           'commit event listener';
			element:        Element;
			name:           string;
			value:          unknown;
			oldListener:    unknown;
			options:        RenderOptions | undefined;
			// True if we're removing the old event listener (e.g. because settings changed, or value is nothing)
			removeListener: boolean;
			// True if we're adding a new event listener (e.g. because first render, or settings changed)
			addListener:    boolean;
		}

		export interface CommitToElementBinding {
			kind:    'commit to element binding';
			element: Element;
			value:   unknown;
			options: RenderOptions | undefined;
		}
	}
}


class LitDebugEvent extends CustomEvent<LitUnstable.DebugLog.Entry> {

	constructor(entry: LitUnstable.DebugLog.Entry) { super('lit-debug', { detail: entry }); }

}


/**
 * Useful for visualizing and logging insights into what the Lit template system is doing.
 *
 * Compiled out of prod mode builds.
 */
export const debugLogEvent: ((event: LitUnstable.DebugLog.Entry) => any) | undefined = DEV_MODE.value
	? (event: LitUnstable.DebugLog.Entry) =>
		global.emitLitDebugLogEvents && global.dispatchEvent(new LitDebugEvent(event))
	: undefined;


// Used for connecting beginRender and endRender events when there are nested
// renders when errors are thrown preventing an endRender event from being called.
export const debugLogRenderId = { value: 0 };
