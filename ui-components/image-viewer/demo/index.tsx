import { AdapterElement, type HTMLAdapterElement, provider } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle, render } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import { ImageViewer, type ImageViewerCmp } from '../src/image-viewer.tsx';


@provider()
export class RootPageCmp extends AdapterElement {

	static override tagName = 'iv-root-page';

	protected get imageViewer(): HTMLAdapterElement<ImageViewerCmp> | undefined {
		return this.element.shadowRoot
			?.querySelector('iv-image-viewer') ?? undefined;
	}

	protected override render(): unknown {
		return <>
			<ImageViewer
				image-src="/spiral.jpg"
				reset-on-new-image
			></ImageViewer>

			<s-controls>
				<button on-click={ () => this.imageViewer?.adapter.api.reset() }>
					Reset
				</button>
				<button on-click={ () => this.imageViewer?.adapter.api.fitToView() }>
					Fit to view
				</button>
				<button on-click={ () => this.imageViewer?.adapter.api.zoom(1.1) }>
					Zoom in
				</button>
				<button on-click={ () => this.imageViewer?.adapter.api.zoom(1 / 1.1) }>
					Zoom out
				</button>
				<button on-click={ () => this.imageViewer?.adapter.api.rotate(-90) }>
					rotate left
				</button>
				<button on-click={ () => this.imageViewer?.adapter.api.rotate(90) }>
					rotate right
				</button>
			</s-controls>
		</>;
	}

	static override styles: CSSStyle = css`
		:host {
			display: grid;
			place-items: center;
		}
		iv-image-viewer {
			height: 80dvh;
			width: clamp(320px, 80vw, 1800px);
			border: 1px solid darkslateblue;
		}
		s-controls {
			display: flex;
		}
	`;

}

const RootPage: ToComponent<RootPageCmp> = toComponent(RootPageCmp);

render(<RootPage />, document.body);
