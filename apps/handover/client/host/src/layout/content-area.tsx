import { AdapterElement, property, state } from '@arcmantle/adapter-element/adapter';

import type { Content, ContentCtor, ContentLocation } from '../extensions/create-manifest.ts';


export abstract class ContentArea extends AdapterElement {

	@property(String) accessor activeTemplateId: string = '';
	@state() protected accessor content: Content;

	abstract contentLocation: ContentLocation;

	protected override beforeUpdate(changedProps: Map<keyof any, any>): void {
		super.beforeUpdate(changedProps);

		if (changedProps.has('activeTemplateId'))
			this.resolveContent();
	}

	protected resolveContent(): void {
		const content = this.inject.getAll<ContentCtor>('content');
		const contentCtor = content.find(c => c.manifest.id === this.activeTemplateId);
		if (!contentCtor)
			return;

		if (contentCtor.manifest.availableLocations.includes(this.contentLocation)) {
			this.content = new contentCtor();
			this.content.initialize();
		}
	}

}
