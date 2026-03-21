import { type CharacterMotionCommand, CharacterMotionController } from '../base/motion-controller';
import { SpriteCharacter, type SpriteCharacterOptions } from '../base/sprite-character';
import { type CharacterStatus, type CharacterUpdateContext, type SpriteSheetFrames } from '../base/types';
import {
	KNIGHT_FRAME_HEIGHT,
	KNIGHT_FRAME_WIDTH,
	type KnightAnimationDefinition,
	knightAnimationLibrary,
	knightAnimationMap,
} from './animation-manifest';
import { KnightSpriteSheetLoader } from './sprite-sheet';

export interface KnightCharacterStatus extends CharacterStatus {
	actionId?: string;
}

export interface KnightCharacterOptions extends Omit<
	SpriteCharacterOptions<KnightAnimationDefinition, SpriteSheetFrames>,
	'characterType' | 'defaultFrameHeight' | 'defaultFrameWidth' | 'loader'
> {
	loader?: KnightSpriteSheetLoader;
}

export type KnightMotionCommand = CharacterMotionCommand<CharacterUpdateContext>;

export interface KnightActionHandle {
	readonly finished: Promise<boolean>;

	cancel(): void;
}

export interface KnightMoveActionOptions {
	distancePx?:       number;
	speedPxPerSecond?: number;
}

export interface KnightJumpActionOptions {
	deltaX?:     number;
	durationMs?: number;
	facing?:     -1 | 1;
	peakHeight?: number;
}

export interface KnightTimedActionOptions {
	durationMs?: number;
}

export interface KnightDirectionalActionOptions extends KnightTimedActionOptions {
	direction?: -1 | 1;
}

export interface KnightDistanceActionOptions extends KnightDirectionalActionOptions {
	distancePx?:       number;
	speedPxPerSecond?: number;
}

export interface KnightCharacterActions {
	attack(options?: KnightTimedActionOptions): KnightActionHandle;
	attackCombo(options?: KnightTimedActionOptions): KnightActionHandle;
	cancelCurrent(): void;
	climb(options?: KnightTimedActionOptions): KnightActionHandle;
	crouch(options?: KnightTimedActionOptions): KnightActionHandle;
	crouchAttack(options?: KnightTimedActionOptions): KnightActionHandle;
	dash(options?: KnightDistanceActionOptions): KnightActionHandle;
	die(options?: KnightTimedActionOptions): KnightActionHandle;
	hit(options?: KnightTimedActionOptions): KnightActionHandle;
	jump(options?: KnightJumpActionOptions): KnightActionHandle;
	moveLeft(options?: KnightMoveActionOptions): KnightActionHandle;
	moveRight(options?: KnightMoveActionOptions): KnightActionHandle;
	roll(options?: KnightDistanceActionOptions): KnightActionHandle;
	slide(options?: KnightDistanceActionOptions): KnightActionHandle;
	turn(options?: KnightDirectionalActionOptions): KnightActionHandle;
}

interface KnightActionRuntime {
	completeWhen: (timestamp: number) => boolean;
	onCancel?:    () => void;
	onComplete?:  () => void;
	ready:        boolean;
	reject:       (reason?: unknown) => void;
	resolve:      (value: boolean) => void;
	settled:      boolean;
}

interface KnightActionPlan {
	completeWhen: (timestamp: number) => boolean;
	onCancel?:    () => void;
	onComplete?:  () => void;
}

export class KnightCharacter extends SpriteCharacter<
	KnightAnimationDefinition,
	SpriteSheetFrames,
	KnightCharacterStatus
> {

	readonly animations: Readonly<Record<string, KnightAnimationDefinition>> = knightAnimationLibrary;
	readonly actions:    KnightCharacterActions;

	readonly #motionController: CharacterMotionController<CharacterUpdateContext> = new CharacterMotionController();

	#currentAction:   KnightActionRuntime | null = null;
	#currentActionId: string | null = null;
	#lastMotionUpdateTime = 0;

	constructor(options: KnightCharacterOptions) {
		super({
			baselineOffsetFactor: options.baselineOffsetFactor,
			characterType:        'knight',
			defaultFrameHeight:   KNIGHT_FRAME_HEIGHT,
			defaultFrameWidth:    KNIGHT_FRAME_WIDTH,
			id:                   options.id,
			loader:               options.loader ?? new KnightSpriteSheetLoader(),
			panelRoot:            options.panelRoot,
			playing:              options.playing,
			screenX:              options.screenX,
			spriteScale:          options.spriteScale,
		});

		const character = this;

		this.actions = Object.freeze({
			attack(actionOptions?: KnightTimedActionOptions) {
				return character.#startAnimationAction('attack', 'attackNoMovement', actionOptions);
			},
			attackCombo(actionOptions?: KnightTimedActionOptions) {
				return character.#startAnimationAction('attackCombo', 'attackComboNoMovement', actionOptions);
			},
			cancelCurrent: () => {
				character.#cancelCurrentAction();
			},
			climb(actionOptions?: KnightTimedActionOptions) {
				return character.#startClimbAction(actionOptions);
			},
			crouch(actionOptions?: KnightTimedActionOptions) {
				return character.#startCrouchAction(actionOptions);
			},
			crouchAttack(actionOptions?: KnightTimedActionOptions) {
				return character.#startAnimationAction('crouchAttack', 'crouchAttack', actionOptions);
			},
			dash(actionOptions?: KnightDistanceActionOptions) {
				return character.#startDistanceAction('dash', 'dash', actionOptions);
			},
			die(actionOptions?: KnightTimedActionOptions) {
				return character.#startDieAction(actionOptions);
			},
			hit(actionOptions?: KnightTimedActionOptions) {
				return character.#startAnimationAction('hit', 'hit', actionOptions);
			},
			jump(actionOptions?: KnightJumpActionOptions) {
				return character.#startJumpAction(actionOptions);
			},
			moveLeft(actionOptions?: KnightMoveActionOptions) {
				return character.#startMoveAction(-1, actionOptions);
			},
			moveRight(actionOptions?: KnightMoveActionOptions) {
				return character.#startMoveAction(1, actionOptions);
			},
			roll(actionOptions?: KnightDistanceActionOptions) {
				return character.#startDistanceAction('roll', 'roll', actionOptions);
			},
			slide(actionOptions?: KnightDistanceActionOptions) {
				return character.#startDistanceAction('slide', 'slide', actionOptions);
			},
			turn(actionOptions?: KnightDirectionalActionOptions) {
				return character.#startTurnAction(actionOptions);
			},
		});

		void this.#setAnimationById('idle');
	}

	clampToViewport(): void {
		if (this.viewportWidth <= 0)
			return;

		this.setScreenX(Math.max(this.minScreenX, Math.min(this.maxScreenX, this.screenX)));
	}

	jump(deltaX: number, peakHeight: number, durationMs = 720): void {
		this.#motionController.jump(deltaX, peakHeight, durationMs);
	}

	moveToward(targetX: number, speedPxPerSecond: number, arrivalThreshold = 0.5): void {
		this.#motionController.moveToward(targetX, speedPxPerSecond, arrivalThreshold);
	}

	stopMotion(): void {
		this.#motionController.stop(this);
	}

	queueMotion(commands: readonly KnightMotionCommand[]): void {
		this.#motionController.enqueue(commands);
	}

	replaceMotion(commands: readonly KnightMotionCommand[]): void {
		this.#motionController.replaceQueue(commands, this);
	}

	turnTo(direction: -1 | 1): void {
		this.#motionController.turnTo(this, direction);
	}

	walkDistance(direction: -1 | 1, distance: number, speedPxPerSecond: number): void {
		this.#motionController.walkDistance(direction, distance, speedPxPerSecond);
	}

	get hasActiveHorizontalMotion(): boolean {
		return this.#motionController.hasActiveHorizontalMotion;
	}

	get hasQueuedMotionCommands(): boolean {
		return this.#motionController.hasQueuedCommands;
	}

	get isJumping(): boolean {
		return this.#motionController.isJumping;
	}

	get motionCommandLabel(): string | null {
		return this.#motionController.activeCommandLabel;
	}

	get currentActionId(): string | null {
		return this.#currentActionId;
	}

	get hasActiveAction(): boolean {
		return this.#currentAction !== null;
	}

	get maxScreenX(): number {
		return Math.round((this.viewportWidth / 2) - this.#resolveHalfCharacterWidth());
	}

	get minScreenX(): number {
		return Math.round((-this.viewportWidth / 2) + this.#resolveHalfCharacterWidth());
	}

	override dispose(): void {
		this.#cancelCurrentAction();
		super.dispose();
	}

	override update(
		timestamp: number,
		context: CharacterUpdateContext,
	): boolean {
		const motionDeltaMs = this.#lastMotionUpdateTime === 0 ? 0 : timestamp - this.#lastMotionUpdateTime;
		this.#lastMotionUpdateTime = timestamp;
		this.#motionController.update(this, timestamp, motionDeltaMs, context);
		this.#updateCurrentAction(timestamp);
		this.clampToViewport();

		return super.update(timestamp, context);
	}

	protected override buildStatus(
		definition: KnightAnimationDefinition,
		frames: SpriteSheetFrames,
	): KnightCharacterStatus {
		return {
			...super.buildStatus(definition, frames),
			actionId:      this.#currentActionId ?? undefined,
			motionCommand: this.motionCommandLabel ?? undefined,
		};
	}

	#resolveHalfCharacterWidth(): number {
		const spriteScale = this.spriteScale ?? 4;

		return Math.round((KNIGHT_FRAME_WIDTH * spriteScale) / 2);
	}

	async #setAnimationById(animationId: string): Promise<void> {
		const definition = knightAnimationMap.get(animationId);
		if (!definition)
			throw new Error(`Knight animation ${ animationId } is missing.`);

		await this.setAnimation(definition);
	}

	#cancelCurrentAction(): void {
		const action = this.#currentAction;
		if (!action)
			return;

		this.#settleAction(action, false);
	}

	#createAction(
		actionId: string,
		setup: (action: KnightActionRuntime) => Promise<KnightActionPlan>,
	): KnightActionHandle {
		this.#cancelCurrentAction();

		let resolvePromise: (value: boolean) => void = () => {};
		let rejectPromise: (reason?: unknown) => void = () => {};
		const finished: Promise<boolean> = new Promise((resolve, reject) => {
			resolvePromise = resolve;
			rejectPromise = reject;
		});

		const action: KnightActionRuntime = {
			completeWhen: () => false,
			ready:        false,
			reject:       rejectPromise,
			resolve:      resolvePromise,
			settled:      false,
		};

		this.#currentAction = action;
		this.#currentActionId = actionId;
		void setup(action)
			.then((plan) => {
				if (this.#currentAction !== action || action.settled)
					return;

				action.completeWhen = plan.completeWhen;
				action.onCancel = plan.onCancel;
				action.onComplete = plan.onComplete;
				action.ready = true;
			})
			.catch((error: unknown) => {
				if (this.#currentAction === action) {
					this.#currentAction = null;
					this.#currentActionId = null;
				}

				if (action.settled)
					return;

				action.settled = true;
				action.reject(error);
			});

		return {
			cancel: () => {
				if (this.#currentAction === action)
					this.#cancelCurrentAction();
			},
			finished,
		};
	}

	#resolveActionDurationMs(fallbackDurationMs: number): number {
		const definition = this.currentDefinition;
		const frames = this.currentFrames;
		if (!definition || !frames)
			return fallbackDurationMs;

		return Math.max(fallbackDurationMs, Math.round((frames.frameCount / definition.fps) * 1000));
	}

	#resolveCurrentAnimationDurationMs(fallbackDurationMs: number): number {
		const definition = this.currentDefinition;
		const frames = this.currentFrames;
		if (!definition || !frames)
			return fallbackDurationMs;

		return Math.round((frames.frameCount / definition.fps) * 1000);
	}

	#returnToIdle(): void {
		this.stopMotion();
		this.setPlaying(true);
		void this.#setAnimationById('idle');
	}

	#settleAction(action: KnightActionRuntime, completed: boolean): void {
		if (action.settled)
			return;

		action.settled = true;
		if (this.#currentAction === action) {
			this.#currentAction = null;
			this.#currentActionId = null;
		}

		if (completed)
			action.onComplete?.();
		else
			action.onCancel?.();

		action.resolve(completed);
	}

	#startClimbAction(options?: KnightTimedActionOptions): KnightActionHandle {
		return this.#createAction('climb', async () => {
			await this.#setAnimationById('wallClimbNoMovement');
			this.restart();
			const durationMs = options?.durationMs ?? this.#resolveActionDurationMs(900);
			const finishAt = performance.now() + durationMs;

			return {
				completeWhen: (timestamp) => timestamp >= finishAt,
				onCancel:     () => {
					this.#returnToIdle();
				},
				onComplete: () => {
					this.#returnToIdle();
				},
			};
		});
	}

	#startAnimationAction(
		actionId: string,
		animationId: string,
		options?: KnightTimedActionOptions,
	): KnightActionHandle {
		return this.#createAction(actionId, async () => {
			this.stopMotion();
			await this.#setAnimationById(animationId);
			this.restart();
			this.setPlaying(true);
			const durationMs = options?.durationMs ?? this.#resolveActionDurationMs(700);
			const finishAt = performance.now() + durationMs;

			return {
				completeWhen: (timestamp) => timestamp >= finishAt,
				onCancel:     () => {
					this.#returnToIdle();
				},
				onComplete: () => {
					this.#returnToIdle();
				},
			};
		});
	}

	#startCrouchAction(options?: KnightTimedActionOptions): KnightActionHandle {
		return this.#createAction('crouch', async () => {
			await this.#setAnimationById('crouch');
			this.restart();
			const durationMs = options?.durationMs ?? this.#resolveActionDurationMs(600);
			const finishAt = performance.now() + durationMs;

			return {
				completeWhen: (timestamp) => timestamp >= finishAt,
				onCancel:     () => {
					this.#returnToIdle();
				},
				onComplete: () => {
					this.#returnToIdle();
				},
			};
		});
	}

	#startDieAction(options?: KnightTimedActionOptions): KnightActionHandle {
		return this.#createAction('die', async () => {
			this.stopMotion();
			await this.#setAnimationById('deathNoMovement');
			this.restart();
			this.setPlaying(true);
			const durationMs = this.#resolveCurrentAnimationDurationMs(options?.durationMs ?? 900);
			const finishAt = performance.now() + durationMs;

			return {
				completeWhen: (timestamp) => timestamp >= finishAt,
				onCancel:     () => {
					this.#returnToIdle();
				},
				onComplete: () => {
					this.stopMotion();
					this.stopAtLastFrame();
				},
			};
		});
	}

	#startJumpAction(options?: KnightJumpActionOptions): KnightActionHandle {
		return this.#createAction('jump', async () => {
			const deltaX = options?.deltaX ?? 0;
			const peakHeight = options?.peakHeight ?? 44;
			const durationMs = options?.durationMs ?? 760;
			const facing = options?.facing ?? (deltaX === 0 ? this.facing : (deltaX >= 0 ? 1 : -1));

			await this.#setAnimationById('jump');
			this.restart();
			this.turnTo(facing);
			this.jump(deltaX, peakHeight, durationMs);

			return {
				completeWhen: () => !this.isJumping,
				onCancel:     () => {
					this.#returnToIdle();
				},
				onComplete: () => {
					this.#returnToIdle();
				},
			};
		});
	}

	#startDistanceAction(
		actionId: string,
		animationId: string,
		options?: KnightDistanceActionOptions,
	): KnightActionHandle {
		return this.#createAction(actionId, async () => {
			const direction = options?.direction ?? this.facing;
			const distancePx = options?.distancePx ?? 96;
			const speedPxPerSecond = options?.speedPxPerSecond ?? 196;

			await this.#setAnimationById(animationId);
			this.restart();
			this.turnTo(direction);
			this.walkDistance(direction, distancePx, speedPxPerSecond);

			return {
				completeWhen: () => !this.hasActiveHorizontalMotion && !this.hasQueuedMotionCommands,
				onCancel:     () => {
					this.#returnToIdle();
				},
				onComplete: () => {
					this.#returnToIdle();
				},
			};
		});
	}

	#startMoveAction(direction: -1 | 1, options?: KnightMoveActionOptions): KnightActionHandle {
		return this.#createAction(direction < 0 ? 'moveLeft' : 'moveRight', async () => {
			const distancePx = options?.distancePx ?? 96;
			const speedPxPerSecond = options?.speedPxPerSecond ?? 156;

			await this.#setAnimationById('run');
			this.restart();
			this.turnTo(direction);
			this.walkDistance(direction, distancePx, speedPxPerSecond);

			return {
				completeWhen: () => !this.hasActiveHorizontalMotion && !this.hasQueuedMotionCommands,
				onCancel:     () => {
					this.#returnToIdle();
				},
				onComplete: () => {
					this.#returnToIdle();
				},
			};
		});
	}

	#startTurnAction(options?: KnightDirectionalActionOptions): KnightActionHandle {
		return this.#createAction('turn', async () => {
			const direction = options?.direction ?? (this.facing === 1 ? -1 : 1);

			await this.#setAnimationById('turnAround');
			this.restart();
			this.setPlaying(true);
			this.turnTo(direction);
			const durationMs = options?.durationMs ?? this.#resolveActionDurationMs(450);
			const finishAt = performance.now() + durationMs;

			return {
				completeWhen: (timestamp) => timestamp >= finishAt,
				onCancel:     () => {
					this.#returnToIdle();
				},
				onComplete: () => {
					this.#returnToIdle();
				},
			};
		});
	}

	#updateCurrentAction(timestamp: number): void {
		const action = this.#currentAction;
		if (!action || !action.ready || action.settled)
			return;

		if (action.completeWhen(timestamp))
			this.#settleAction(action, true);
	}

}
