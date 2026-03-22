import { type CharacterUpdateContext } from '../characters/base/types';
import {
	type OrillusionKnightViewer,
	type ViewerSystem,
} from '../orillusion-viewer';
import { resolveKnightBodyHitbox } from './hitboxes';

const getDevicePixelRatio = (): number => Math.max(1, window.devicePixelRatio || 1);

export class KnightHitboxDiagnostics implements ViewerSystem {

	readonly #canvas:  HTMLCanvasElement;
	readonly #context: CanvasRenderingContext2D;
	readonly #host:    HTMLElement;

	#ownsHostPosition = false;

	constructor(host: HTMLElement) {
		this.#host = host;
		this.#canvas = document.createElement('canvas');
		this.#canvas.setAttribute('aria-hidden', 'true');
		this.#canvas.style.inset = '0';
		this.#canvas.style.pointerEvents = 'none';
		this.#canvas.style.position = 'absolute';
		this.#canvas.style.zIndex = '20';

		const computedStyle = window.getComputedStyle(host);
		if (computedStyle.position === 'static') {
			host.style.position = 'relative';
			this.#ownsHostPosition = true;
		}

		host.appendChild(this.#canvas);
		const context = this.#canvas.getContext('2d');
		if (!context)
			throw new Error('2D canvas context unavailable for knight hitbox diagnostics.');

		this.#context = context;
	}

	dispose(): void {
		this.#canvas.remove();
		if (this.#ownsHostPosition)
			this.#host.style.removeProperty('position');
	}

	update(viewer: OrillusionKnightViewer, _timestamp: number, context: CharacterUpdateContext): void {
		this.#resizeCanvas(context.viewportWidth, context.viewportHeight);
		this.#context.clearRect(0, 0, context.viewportWidth, context.viewportHeight);
		for (const characterStatus of viewer.getCharacterStatuses()) {
			const character = viewer.getCharacter(characterStatus.characterId);
			if (!character)
				continue;

			const contentBounds = character.getCurrentContentBounds();
			if (contentBounds) {
				this.#drawBox({
					height:  contentBounds.height,
					width:   contentBounds.width,
					centerX: contentBounds.centerX,
					centerY: contentBounds.centerY,
				}, context.viewportWidth, context.viewportHeight, {
					lineDash:    [ 4, 3 ],
					lineWidth:   1.5,
					strokeStyle: 'rgba(255, 191, 64, 0.95)',
				});
			}

			this.#drawBox(resolveKnightBodyHitbox(character), context.viewportWidth, context.viewportHeight, {
				lineDash:    [ 8, 4 ],
				lineWidth:   2,
				strokeStyle: 'rgba(0, 255, 120, 0.95)',
			});
		}
	}

	#drawBox(
		hitbox: { centerX: number; centerY: number; height: number; width: number; },
		viewportWidth: number,
		viewportHeight: number,
		style: {
			lineDash:    number[];
			lineWidth:   number;
			strokeStyle: string;
		},
	): void {
		const left = (viewportWidth / 2) + hitbox.centerX - (hitbox.width / 2);
		const top = (viewportHeight / 2) - hitbox.centerY - (hitbox.height / 2);

		this.#context.strokeStyle = style.strokeStyle;
		this.#context.lineWidth = style.lineWidth;
		this.#context.setLineDash(style.lineDash);
		this.#context.strokeRect(left, top, hitbox.width, hitbox.height);
		this.#context.setLineDash([]);
	}

	#resizeCanvas(width: number, height: number): void {
		const pixelRatio = getDevicePixelRatio();
		const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
		const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
		if (this.#canvas.width === pixelWidth && this.#canvas.height === pixelHeight)
			return;

		this.#canvas.style.width = `${ width }px`;
		this.#canvas.style.height = `${ height }px`;
		this.#canvas.width = pixelWidth;
		this.#canvas.height = pixelHeight;
		this.#context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	}

}
