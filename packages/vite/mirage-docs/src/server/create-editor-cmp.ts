import { promises } from 'node:fs';

import {
	createComponentNameFromPath,
	createComponentTagFromPath,
} from './build/helpers/virtual-helpers.js';
import { editorPageTemplate } from './generators/editor-page-template.js';


export const createEditorComponent = async (
	targetPath: string,
	path: string,
): Promise<string> => {
	let content = await promises.readFile(path, { encoding: 'utf8' });
	const componentTag   = createComponentTagFromPath(path);
	const componentClass = createComponentNameFromPath(path);

	content = content
		.replaceAll('`', '\\`')
		.replaceAll('$', '\\$')
		.replace(
			"import { editorComponent } from '@arcmantle/mirage-docs/app/components/page/editor-component.js';",
			'const editorComponent = ({html, css}) => {}',
		);

	content = editorPageTemplate({
		codeId: targetPath,
		tag:    componentTag,
		class:  componentClass,
		code:   content,
	});

	return content;
};
