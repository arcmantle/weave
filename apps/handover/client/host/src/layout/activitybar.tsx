import { AdapterElement, state } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { For, type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import { Icon } from '../components/icon.tsx';
import type { ActivitybarManifest } from '../extensions/create-manifest.ts';


export class ActivitybarCmp extends AdapterElement {

	static override tagName: string = 'ho-activity';

	@state() accessor activitybar: ActivitybarManifest[] = [];

	override connected(): void {
		super.connected();

		this.activitybar = this.inject.getAll<ActivitybarManifest>('activitybar');
	}

	protected override render(): unknown {
		return <>
			<s-top-actions>
				<For each={ this.activitybar }>
					{activity => <Icon url={as.prop(activity.icon)}></Icon>}
				</For>
			</s-top-actions>

			<s-bottom-actions>
				<For each={ this.activitybar }>
					{activity => <Icon url={as.prop(activity.icon)}></Icon>}
				</For>
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
	`;

}


export const Activitybar: ToComponent<ActivitybarCmp> =
	toComponent(ActivitybarCmp);
