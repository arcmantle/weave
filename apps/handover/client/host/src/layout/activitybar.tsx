import { AdapterElement, state } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { For, type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import { Icon } from '../components/icon.tsx';
import type { ContentCtor, ContentManifest } from '../extensions/create-manifest.ts';


export class ActivitybarCmp extends AdapterElement {

	static override tagName: string = 'ho-activity';

	@state() accessor tabs: ContentManifest[] = [];

	override connected(): void {
		super.connected();

		const availableContent = this.inject.getAll<ContentCtor>('content');
		this.tabs = availableContent.map(content => content.manifest);
	}

	protected override render(): unknown {
		return <>
			<s-top-actions>
				<For each={ this.tabs }>
					{({ tab }) => <button on-click={tab.onClick}>
						<Icon class="icon" url={tab.icon}></Icon>
					</button>}
				</For>
			</s-top-actions>

			<s-bottom-actions>
			</s-bottom-actions>
		</>;
	}

	static override styles: CSSStyle = css`
		:host {
			display: flex;
			flex-direction: column;
			justify-content: space-between;
		}
		s-top-actions, s-bottom-actions {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			align-items: center;
		}
		s-top-actions {
			padding-top: 0.5rem;
		}
		.icon {
			padding: 0.5rem;
		}
	`;

}


export const Activitybar: ToComponent<ActivitybarCmp> =
	toComponent(ActivitybarCmp);
