import { SignalWatcher } from '@arcmantle/handover-core/features/index.ts';
import { LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';

import type { Content, ContentCtor, ContentLocation } from '../extensions/create-manifest.ts';
import { injector } from '../inject.ts';


@SignalWatcher
export abstract class ContentArea extends LitElement {

	@property() accessor activeTemplateId: string | null = null;
	@state() protected accessor content: Content | null = null;

	abstract contentLocation: ContentLocation;

	protected override willUpdate(changedProps: Map<keyof any, any>): void {
		super.willUpdate(changedProps);

		if (changedProps.has('activeTemplateId'))
			this.resolveContent();
	}

	protected resolveContent(): void {
		const content = injector.getAll<ContentCtor>('content');

		console.log(content);

		const contentCtor = content.find(c => c.manifest.id === this.activeTemplateId);
		if (!contentCtor)
			return;

		if (contentCtor.manifest.availableLocations.includes(this.contentLocation!)) {
			this.content = new contentCtor();
			this.content.initialize();
		}
	}

}
