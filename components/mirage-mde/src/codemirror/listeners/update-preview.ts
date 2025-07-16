import { debounce } from '@arcmantle/library/timing';
import { ViewUpdate } from '@codemirror/view';

import { MirageMDE } from '../../mirage-mde.js';
import { editorToPreview } from '../commands/toggle-sidebyside.js';


export const updatePreviewListener = (update: ViewUpdate, scope: MirageMDE): void => {
	if ((scope.isSideBySideActive || scope.isWindowActive) && update.docChanged) {
		val = scope;
		bounced();
	}
};


let val: MirageMDE;

const bounced = debounce(() => editorToPreview(val), 500);
