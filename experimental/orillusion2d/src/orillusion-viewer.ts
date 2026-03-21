import {
	Camera3D,
	Engine3D,
	Object3D,
	Scene3D,
	View3D,
	ViewPanel,
} from '@orillusion/core';

import { type CharacterUpdateContext } from './characters/base/types';
import { type KnightAnimationDefinition } from './characters/knight/animation-manifest';
import { type KnightBehaviorModel } from './characters/knight/behavior-model';
import { KnightCharacter, type KnightCharacterStatus } from './characters/knight/knight-character';
import { KnightSpriteSheetLoader } from './characters/knight/sprite-sheet';

export interface ViewerStatus extends KnightCharacterStatus {
	behaviorId?:    string;
	behaviorLabel?: string;
	behaviorPhase?: string;
}

export interface SpawnCharacterOptions {
	animation:             KnightAnimationDefinition;
	baselineOffsetFactor?: number;
	behavior?:             KnightBehaviorModel | null;
	id?:                   string;
	playing?:              boolean;
	screenX?:              number;
	spriteScale?:          number;
}

type StatusListener = (status: ViewerStatus) => void;

const getDevicePixelRatio = (): number => Math.max(1, window.devicePixelRatio || 1);

export class OrillusionKnightViewer {

	readonly #canvas:         HTMLCanvasElement;
	readonly #container:      HTMLElement;
	readonly #behaviors:      Map<string, KnightBehaviorModel> = new Map();
	readonly #loader = new KnightSpriteSheetLoader();
	readonly #onStatusChange: StatusListener;

	#animationFrameHandle = 0;
	#characterSequence = 0;
	#characters:        Map<string, KnightCharacter> = new Map();
	#camera:            Camera3D | null = null;
	#mouseInside = false;
	#mouseScreenX = 0;
	#mouseScreenY = 0;
	#panel:             ViewPanel | null = null;
	#panelRoot:         Object3D | null = null;
	#activeCharacterId: string | null = null;
	#resizeObserver:    ResizeObserver | null = null;
	#running = false;

	constructor(canvas: HTMLCanvasElement, onStatusChange: StatusListener) {
		this.#canvas = canvas;
		this.#container = canvas.parentElement instanceof HTMLElement ? canvas.parentElement : canvas;
		this.#onStatusChange = onStatusChange;
	}

	async start(initialAnimation: KnightAnimationDefinition, initialBehavior?: KnightBehaviorModel | null): Promise<void> {
		if (!navigator.gpu)
			throw new Error('WebGPU is not available in this browser. Use a recent Chrome or Edge build.');

		this.#resizeCanvas();

		await Engine3D.init({
			canvasConfig: {
				alpha:  true,
				canvas: this.#canvas,
			},
		});

		const scene = new Scene3D();

		const cameraObject = new Object3D();
		this.#camera = cameraObject.addComponent(Camera3D);
		this.#camera.perspective(60, this.#aspectRatio(), 0.1, 5000);
		cameraObject.z = 110;
		scene.addChild(cameraObject);

		const view = new View3D();
		view.scene = scene;
		view.camera = this.#camera;
		Engine3D.startRenderView(view);

		const uiCanvas = view.enableUICanvas();
		const panelRoot = new Object3D();
		this.#panelRoot = panelRoot;
		this.#panel = panelRoot.addComponent(ViewPanel);
		uiCanvas.addChild(panelRoot);
		this.#resizePanel();

		await this.spawnCharacter({
			animation: initialAnimation,
			behavior:  initialBehavior,
		});

		this.#resizeObserver = new ResizeObserver(() => {
			this.#handleResize();
		});
		this.#resizeObserver.observe(this.#container);
		window.addEventListener('pointermove', this.#handlePointerMove);
		window.addEventListener('blur', this.#handlePointerBlur);
		this.#running = true;
		this.#animationFrameHandle = window.requestAnimationFrame(this.#tick);
	}

	stop(): void {
		this.#running = false;
		window.cancelAnimationFrame(this.#animationFrameHandle);
		this.#resizeObserver?.disconnect();
		this.#resizeObserver = null;
		window.removeEventListener('pointermove', this.#handlePointerMove);
		window.removeEventListener('blur', this.#handlePointerBlur);

		for (const character of this.#characters.values())
			character.dispose();

		this.#characters.clear();
		for (const behavior of this.#behaviors.values())
			behavior.dispose?.();

		this.#behaviors.clear();
		this.#panelRoot = null;
		this.#activeCharacterId = null;
	}

	async setAnimation(definition: KnightAnimationDefinition): Promise<void> {
		const character = this.#requireActiveCharacter();
		await character.setAnimation(definition);
		this.#emitStatus();
	}

	setPlaying(playing: boolean): void {
		this.#requireActiveCharacter().setPlaying(playing);
		this.#emitStatus();
	}

	setBehavior(behavior: KnightBehaviorModel | null): void {
		const character = this.#requireActiveCharacter();
		this.#setBehaviorForCharacter(character.id, behavior);
		this.#emitStatus();
	}

	restart(): void {
		this.#requireActiveCharacter().restart();
		this.#emitStatus();
	}

	setActiveCharacter(id: string): void {
		if (!this.#characters.has(id))
			throw new Error(`Character ${ id } does not exist.`);

		this.#activeCharacterId = id;
		this.#emitStatus();
	}

	getCharacterIds(): string[] {
		return [ ...this.#characters.keys() ];
	}

	getCharacterStatuses(): KnightCharacterStatus[] {
		return [ ...this.#characters.values() ]
			.map((character) => character.getStatus())
			.filter((status): status is KnightCharacterStatus => status !== null);
	}

	async spawnCharacter(options: SpawnCharacterOptions): Promise<string> {
		if (!this.#panelRoot)
			throw new Error('Viewer must be started before spawning characters.');

		const id = options.id ?? `character-${ ++this.#characterSequence }`;
		if (this.#characters.has(id))
			throw new Error(`Character ${ id } already exists.`);

		const character = new KnightCharacter({
			baselineOffsetFactor: options.baselineOffsetFactor,
			id,
			loader:               this.#loader,
			panelRoot:            this.#panelRoot,
			playing:              options.playing,
			screenX:              options.screenX,
			spriteScale:          options.spriteScale,
		});

		this.#characters.set(id, character);
		this.#setBehaviorForCharacter(id, options.behavior ?? null);
		character.resize(this.#displayWidth(), this.#displayHeight());
		await character.setAnimation(options.animation);

		if (!this.#activeCharacterId)
			this.#activeCharacterId = id;

		if (id === this.#activeCharacterId)
			this.#emitStatus();

		return id;
	}

	removeCharacter(id: string): void {
		const character = this.#characters.get(id);
		if (!character)
			return;

		character.dispose();
		this.#characters.delete(id);
		this.#disposeBehavior(id);

		if (this.#activeCharacterId === id)
			this.#activeCharacterId = this.#characters.keys().next().value ?? null;

		this.#emitStatus();
	}

	#tick = (timestamp: number): void => {
		if (!this.#running)
			return;

		const updateContext = this.#buildUpdateContext();
		let shouldEmitStatus = false;
		for (const [ id, character ] of this.#characters.entries()) {
			character.update(timestamp, updateContext);
			this.#behaviors.get(id)?.update(character, timestamp, updateContext);
			if (id === this.#activeCharacterId)
				shouldEmitStatus = true;
		}

		if (shouldEmitStatus)
			this.#emitStatus();

		this.#animationFrameHandle = window.requestAnimationFrame(this.#tick);
	};

	#emitStatus(): void {
		const character = this.#activeCharacter();
		if (!character)
			return;

		const status = character.getStatus();
		if (!status)
			return;

		const behavior = this.#activeBehavior();
		this.#onStatusChange({
			...status,
			behaviorId:    behavior?.id,
			behaviorLabel: behavior?.label,
			behaviorPhase: behavior?.getPhaseLabel?.(),
		});
	}

	#handleResize = (): void => {
		const displayWidth = this.#displayWidth();
		const displayHeight = this.#displayHeight();

		this.#resizeCanvas();
		this.#resizePanel();

		if (this.#camera)
			this.#camera.perspective(60, this.#aspectRatio(), 0.1, 5000);

		for (const character of this.#characters.values())
			character.resize(displayWidth, displayHeight);

		this.#emitStatus();
	};

	#resizePanel(): void {
		this.#panel?.uiTransform.resize(this.#displayWidth(), this.#displayHeight());
	}

	#resizeCanvas(): void {
		const displayWidth = this.#displayWidth();
		const displayHeight = this.#displayHeight();
		const pixelRatio = getDevicePixelRatio();

		this.#canvas.style.width = `${ displayWidth }px`;
		this.#canvas.style.height = `${ displayHeight }px`;
		this.#canvas.width = Math.max(1, Math.round(displayWidth * pixelRatio));
		this.#canvas.height = Math.max(1, Math.round(displayHeight * pixelRatio));
	}

	#displayWidth(): number {
		const rect = this.#container.getBoundingClientRect();

		return Math.max(1, Math.round(rect.width || this.#container.clientWidth || window.innerWidth));
	}

	#displayHeight(): number {
		const rect = this.#container.getBoundingClientRect();

		return Math.max(1, Math.round(rect.height || this.#container.clientHeight || window.innerHeight));
	}

	#aspectRatio(): number {
		return Math.max(1, this.#canvas.width) / Math.max(1, this.#canvas.height);
	}

	#buildUpdateContext(): CharacterUpdateContext {
		return {
			mouseInside:    this.#mouseInside,
			mouseScreenX:   this.#mouseScreenX,
			mouseScreenY:   this.#mouseScreenY,
			viewportHeight: this.#displayHeight(),
			viewportWidth:  this.#displayWidth(),
		};
	}

	#handlePointerMove = (event: PointerEvent): void => {
		const rect = this.#container.getBoundingClientRect();
		const localX = event.clientX - rect.left;
		const localY = event.clientY - rect.top;

		this.#mouseInside = localX >= 0 && localX <= rect.width && localY >= 0 && localY <= rect.height;
		this.#mouseScreenX = localX - (rect.width / 2);
		this.#mouseScreenY = (rect.height / 2) - localY;
	};

	#handlePointerBlur = (): void => {
		this.#mouseInside = false;
	};

	#activeCharacter(): KnightCharacter | null {
		if (!this.#activeCharacterId)
			return null;

		return this.#characters.get(this.#activeCharacterId) ?? null;
	}

	#activeBehavior(): KnightBehaviorModel | null {
		if (!this.#activeCharacterId)
			return null;

		return this.#behaviors.get(this.#activeCharacterId) ?? null;
	}

	#disposeBehavior(characterId: string): void {
		const behavior = this.#behaviors.get(characterId);
		behavior?.dispose?.();
		this.#behaviors.delete(characterId);
	}

	#requireActiveCharacter(): KnightCharacter {
		const character = this.#activeCharacter();
		if (!character)
			throw new Error('Active character is not available.');

		return character;
	}

	#setBehaviorForCharacter(characterId: string, behavior: KnightBehaviorModel | null): void {
		this.#disposeBehavior(characterId);
		if (!behavior)
			return;

		this.#behaviors.set(characterId, behavior);
	}

}
