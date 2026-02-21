import { lazyWeakmap } from '@arcmantle/library/structs';
import { EditorView, ViewUpdate } from '@codemirror/view';

import { MirageMDE } from '../../mirage-mde.js';


const metadata: WeakMap<EditorView, { initialized: boolean; }> = new WeakMap();


export const updateStatusbarListener = (update: ViewUpdate, scope: MirageMDE): void => {
	const meta = lazyWeakmap(metadata, scope.editor, () => ({ initialized: false }));
	if (!meta.initialized) {
		meta.initialized = true;

		scope.registry.status.forEach(status => {
			status.initialize?.(status, update, scope);
		});
	}

	if (update.selectionSet) {
		scope.registry.status.forEach(status => {
			status.onActivity?.(status, update, scope);
		});
	}

	if (update.docChanged) {
		scope.registry.status.forEach(status => {
			status.onUpdate?.(status, update, scope);
		});
	}

	scope.registry.status.forEach(status => {
		status.onAnyUpdate?.(status, update, scope);
	});

	scope.gui.statusbar.requestUpdate();
};
