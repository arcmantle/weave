import { iterate } from '@arcmantle/library/iterators';
import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	completionKeymap,
} from '@codemirror/autocomplete';
import {
	defaultKeymap,
	history,
	historyKeymap,
} from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import {
	defaultHighlightStyle,
	foldKeymap,
	HighlightStyle,
	indentOnInput,
	indentUnit,
	syntaxHighlighting,
} from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { lintKeymap } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import {
	crosshairCursor,
	drawSelection,
	dropCursor,
	EditorView,
	highlightSpecialChars,
	type KeyBinding,
	keymap,
	lineNumbers,
	rectangularSelection,
} from '@codemirror/view';
import { styleTags, Tag, tags } from '@lezer/highlight';
import { type MarkdownConfig } from '@lezer/markdown';
import { basicDark } from 'cm6-theme-basic-dark';
import { type CSSResultGroup, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { insertTab, removeTab } from '../codemirror/commands/tab-list.js';
import { toggleCheckbox } from '../codemirror/commands/toggle-checkbox.js';
import { editorToPreview, handleEditorScroll } from '../codemirror/commands/toggle-sidebyside.js';
import { updatePreviewListener } from '../codemirror/listeners/update-preview.js';
import { updateStatusbarListener } from '../codemirror/listeners/update-statusbar.js';
import { updateToolbarStateListener } from '../codemirror/listeners/update-toolbar.js';
import { type MirageMDE } from '../mirage-mde.js';
import type { MMDECommand, ToolbarButton } from '../registry/action-registry.js';
import editorStyles from './mirage-mde-editor.css' with { type: 'css' };


@customElement('mirage-mde-editor')
export class EditorElement extends LitElement {

	@property({ type: Object }) scope: MirageMDE;
	protected globalShortcuts:         KeyBinding[] = [];
	protected documentOnKeyDown = (ev: KeyboardEvent): void => {
		const pressedKey = ev.key.toUpperCase();
		const modifierMap: Record<string, string> = {
			'c-': 'ctrlKey',
			'a-': 'altKey',
			's-': 'shiftKey',
		};

		this.globalShortcuts.forEach(({ key, preventDefault, run }) => {
			if (!key)
				return;

			const parts = key.replace(/-/g, '- ').split(' ');
			const modifiers = parts.filter(p => p.includes('-')).map(m => modifierMap[m]!);
			const requiredKey = parts.filter(p => !p.includes('-')).at(0)?.toUpperCase();

			if (modifiers.every(m => (ev as any)[m]) && pressedKey === requiredKey) {
				if (preventDefault)
					ev.preventDefault();

				run?.(this.scope.editor);
			}
		});
	};

	override connectedCallback(): void {
		super.connectedCallback();

		globalThis.addEventListener('keydown', this.documentOnKeyDown);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();

		globalThis.removeEventListener('keydown', this.documentOnKeyDown);
	}

	create(): void {
		const shortcuts = iterate(this.scope.registry.action)
			.pipe(([ , v ]) => v.type === 'button' ? v : undefined)
			.pipe(item => {
				if (!item.shortcut || typeof item.action !== 'function')
					return;

				return item as Omit<ToolbarButton, 'action'> & { action: MMDECommand; };
			})
			.pipe(button => {
				const keybinding: KeyBinding = {
					key:            button.shortcut,
					run:            (view: EditorView) => button.action(view, this.scope),
					preventDefault: true,
				};

				if (button.global)
					this.globalShortcuts.push(keybinding);
				else
					return keybinding;
			})
			.toArray();


		const customTags = {
			headingMark: Tag.define(),
			table:       Tag.define(),
		};

		const MarkStylingExtension: MarkdownConfig = {
			props: [
				styleTags({
					HeaderMark: customTags.headingMark,
				}),
			],
		};


		const extensions = [
			// Consumer custom extensions.
			...this.scope.options.extensions ?? [],

			EditorView.updateListener.of(update => {
				updateToolbarStateListener(update, this.scope);
				updateStatusbarListener(update, this.scope);
				updatePreviewListener(update, this.scope);

				if (update.docChanged) {
					this.dispatchEvent(new CustomEvent('change',
						{ detail: update, bubbles: true, composed: true }));
				}
			}),
			EditorView.domEventHandlers({
				scroll: (ev) => handleEditorScroll(ev, this.scope),
			}),

			history(),
			dropCursor(),
			drawSelection(),
			crosshairCursor(),
			rectangularSelection(),

			indentUnit.of(' '.repeat(this.scope.options.tabSize!)),
			EditorState.tabSize.of(this.scope.options.tabSize!),
			EditorState.allowMultipleSelections.of(true),

			// editor language
			markdown({
				base:          markdownLanguage,
				codeLanguages: languages,
				addKeymap:     true,
				extensions:    [ MarkStylingExtension ],
			}),

			// keyboard behavior
			indentOnInput(),
			closeBrackets(),
			keymap.of([
				...shortcuts,
				{
					key:   'Tab',
					run:   view => insertTab(view, this.scope),
					shift: view => removeTab(view, this.scope),
				},
				{ key: 'c-d', run: toggleCheckbox },
				...closeBracketsKeymap,
				...defaultKeymap,
				...searchKeymap,
				...historyKeymap,
				...foldKeymap,
				...completionKeymap,
				...lintKeymap,
			]),

			// Styles
			//bracketMatching(),
			//highlightActiveLine(),
			//highlightActiveLineGutter(),
			highlightSpecialChars(),
			highlightSelectionMatches(),
			basicDark,
			syntaxHighlighting(HighlightStyle.define([
				{ tag: tags.heading1, class: 'cm-header-1' },
				{ tag: tags.heading2, class: 'cm-header-2' },
				{ tag: tags.heading3, class: 'cm-header-3' },
				{ tag: tags.heading4, class: 'cm-header-4' },
				{ tag: tags.heading5, class: 'cm-header-5' },
				{ tag: tags.heading6, class: 'cm-header-6' },
				{ tag: customTags.headingMark, class: 'ͼ1m cm-heading-mark' },
			])),
			syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
		];

		if (this.scope.options.autocomplete ?? true) {
			extensions.push(
				autocompletion({
					tooltipClass: () => 'mmde-tooltip',
				}),
			);
		}
		if (this.scope.options.lineWrapping)
			extensions.push(EditorView.lineWrapping);
		if (this.scope.options.lineNumbers)
			extensions.push(lineNumbers());

		this.scope.editor = new EditorView({
			parent: this.renderRoot,
			state:  EditorState.create({
				doc: this.scope.options.initialValue,
				extensions,
			}),
		});

		// Do an initial conversion of the markdown to speed up opening the preview.
		requestIdleCallback(() => editorToPreview(this.scope));
	}

	static override styles: CSSResultGroup = editorStyles;

}


declare global {
	interface HTMLElementTagNameMap {
		'mirage-mde-editor': EditorElement;
	}
}
