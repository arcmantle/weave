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

const DEFAULT_MOVEMENT_PIXELS_PER_SECOND_PER_FPS = 15;
const ROLL_MOVEMENT_DISTANCE_MULTIPLIER = 1.75;
const RUN_CANCEL_FINISH_FPS_MULTIPLIER = 2.5;

const resolveRunCancellationFrameIndices = (
	frameCount: number,
	currentFrameIndex: number,
): number[] => {
	const lastFrameIndex = Math.max(0, frameCount - 1);
	const startFrameIndex = Math.max(0, Math.min(lastFrameIndex, currentFrameIndex));
	const midpointFrameIndex = Math.max(0, Math.min(lastFrameIndex, Math.round(lastFrameIndex / 2)));
	const candidateTargets = [ midpointFrameIndex, lastFrameIndex ]
		.filter((frameIndex, index, values) => frameIndex >= startFrameIndex && values.indexOf(frameIndex) === index);
	const targetFrameIndex = candidateTargets.reduce<number | null>((closestFrameIndex, frameIndex) => {
		if (closestFrameIndex === null)
			return frameIndex;

		return (frameIndex - startFrameIndex) < (closestFrameIndex - startFrameIndex)
			? frameIndex
			: closestFrameIndex;
	}, null);
	if (targetFrameIndex === null || targetFrameIndex <= startFrameIndex)
		return [];

	return Array.from(
		{ length: targetFrameIndex - startFrameIndex + 1 },
		(_, index) => startFrameIndex + index,
	);
};

export interface KnightCharacterStatus extends CharacterStatus {
	actionId?: string;
}

export interface KnightCharacterOptions extends Omit<
	SpriteCharacterOptions<KnightAnimationDefinition, SpriteSheetFrames>,
	'characterType' | 'defaultFrameHeight' | 'defaultFrameWidth' | 'loader'
> {
	loader?:                        KnightSpriteSheetLoader;
	movementPixelsPerSecondPerFps?: number;
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

export interface KnightMoveToActionOptions {
	arrivalThreshold?: number;
	speedPxPerSecond?: number;
	targetX:           number;
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
	dodge(options?: KnightDistanceActionOptions): KnightActionHandle;
	hit(options?: KnightTimedActionOptions): KnightActionHandle;
	jump(options?: KnightJumpActionOptions): KnightActionHandle;
	moveLeft(options?: KnightMoveActionOptions): KnightActionHandle;
	moveTo(options: KnightMoveToActionOptions): KnightActionHandle;
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

	#currentAction:                 KnightActionRuntime | null = null;
	#currentActionId:               string | null = null;
	#lastMotionUpdateTime = 0;
	#locomotionRequestToken = 0;
	#movementPixelsPerSecondPerFps: number;
	#postMoveToIdleToken = 0;

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

		this.#movementPixelsPerSecondPerFps = Math.max(
			0,
			options.movementPixelsPerSecondPerFps ?? DEFAULT_MOVEMENT_PIXELS_PER_SECOND_PER_FPS,
		);

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
			dodge(actionOptions?: KnightDistanceActionOptions) {
				return character.#startDodgeAction(actionOptions);
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
			moveTo(actionOptions: KnightMoveToActionOptions) {
				return character.#startMoveToAction(actionOptions);
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
		this.#motionController.moveToward(
			targetX,
			this.#resolveAnimationScaledSpeedPxPerSecond(speedPxPerSecond),
			arrivalThreshold,
		);
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
		this.#motionController.walkDistance(
			direction,
			distance,
			this.#resolveAnimationScaledSpeedPxPerSecond(speedPxPerSecond),
		);
	}

	runToward(targetX: number, speedPxPerSecond: number, arrivalThreshold = 0.5): void {
		if (this.hasActiveAction)
			return;

		this.#postMoveToIdleToken += 1;
		const direction = targetX >= this.screenX ? 1 : -1;
		const scaledSpeedPxPerSecond = this.#resolveAnimationScaledSpeedPxPerSecond(speedPxPerSecond);
		const resolvedArrivalThreshold = Math.max(0.5, arrivalThreshold);
		const beginRun = (): void => {
			if (this.hasActiveAction)
				return;

			this.turnTo(direction);
			if (!this.playing)
				this.setPlaying(true);

			this.moveToward(targetX, scaledSpeedPxPerSecond, resolvedArrivalThreshold);
		};

		if (this.animationId === 'run') {
			beginRun();

			return;
		}

		const locomotionRequestToken = ++this.#locomotionRequestToken;
		void this.#setAnimationById('run').then(() => {
			if (this.#locomotionRequestToken !== locomotionRequestToken)
				return;

			this.restart();
			beginRun();
		});
	}

	stopRunning(): void {
		this.#locomotionRequestToken += 1;
		this.#postMoveToIdleToken += 1;
		if (this.hasActiveAction)
			return;

		this.stopMotion();
		if (this.animationId === 'run')
			this.#returnToIdle();
	}

	get hasActiveHorizontalMotion(): boolean {
		return this.#motionController.hasActiveHorizontalMotion;
	}

	get movementPixelsPerSecondPerFps(): number {
		return this.#movementPixelsPerSecondPerFps;
	}

	setMovementPixelsPerSecondPerFps(value: number): void {
		this.#movementPixelsPerSecondPerFps = Math.max(0, value);
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
		return this.resolveViewportClampX('right');
	}

	get minScreenX(): number {
		return this.resolveViewportClampX('left');
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

	#resolveCurrentAnimationDistancePx(fallbackDistancePx: number): number {
		const frames = this.currentFrames;
		if (!frames)
			return Math.max(1, fallbackDistancePx);

		return Math.max(
			1,
			frames.frameCount * this.#movementPixelsPerSecondPerFps * this.#resolveCurrentAnimationTravelMultiplier(),
		);
	}

	#resolveDistanceMatchedAnimationSpeedPxPerSecond(distancePx: number, fallbackSpeedPxPerSecond: number): number {
		const animationDurationMs = this.#resolveCurrentAnimationDurationMs(0);
		if (animationDurationMs <= 0 || distancePx <= 0)
			return this.#resolveAnimationScaledSpeedPxPerSecond(fallbackSpeedPxPerSecond);

		return Math.max(1, distancePx / (animationDurationMs / 1000));
	}

	#resolveAnimationScaledSpeedPxPerSecond(_speedPxPerSecond: number): number {
		const definition = this.currentDefinition;
		if (!definition || definition.fps <= 0)
			return this.#movementPixelsPerSecondPerFps;

		return Math.max(
			1,
			definition.fps * this.#movementPixelsPerSecondPerFps * this.#resolveCurrentAnimationTravelMultiplier(),
		);
	}

	#resolveCurrentAnimationTravelMultiplier(): number {
		return this.currentDefinition?.id === 'roll'
			? ROLL_MOVEMENT_DISTANCE_MULTIPLIER
			: 1;
	}

	#returnToIdle(): void {
		this.#postMoveToIdleToken += 1;
		this.stopMotion();
		this.setPlaying(true);
		void this.#setAnimationById('idle');
	}

	#finishRunCancellationToIdle(): void {
		const definition = this.currentDefinition;
		const frames = this.currentFrames;
		if (!definition || !frames || definition.id !== 'run') {
			this.#returnToIdle();

			return;
		}

		const remainingFrameIndices = resolveRunCancellationFrameIndices(
			frames.frameCount,
			this.currentFrameIndex,
		);
		if (remainingFrameIndices.length <= 1) {
			this.#returnToIdle();

			return;
		}

		const finishToken = ++this.#postMoveToIdleToken;
		const finishFps = Math.max(1, definition.fps * RUN_CANCEL_FINISH_FPS_MULTIPLIER);
		const finishDurationMs = Math.max(1, Math.round(((remainingFrameIndices.length - 1) / finishFps) * 1000));

		this.stopMotion();
		this.playFrameSequence(remainingFrameIndices, finishFps);
		setTimeout(() => {
			if (this.#postMoveToIdleToken !== finishToken)
				return;

			if (this.hasActiveAction)
				return;

			if (this.animationId !== 'run')
				return;

			this.#returnToIdle();
		}, finishDurationMs);
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

	#startDodgeAction(options?: KnightDistanceActionOptions): KnightActionHandle {
		return this.#createAction('dodge', async () => {
			const retreatDirection = options?.direction ?? this.facing;
			const rollFacing = retreatDirection === 1 ? -1 : 1;
			const requestedDistancePx = Math.max(0, options?.distancePx ?? 96);
			const speedPxPerSecond = options?.speedPxPerSecond ?? 196;

			this.stopMotion();
			await this.#setAnimationById('turnAround');
			this.restart();
			this.setPlaying(true);
			this.turnTo(retreatDirection);

			const turnDurationMs = this.#resolveCurrentAnimationDurationMs(450);
			const turnFinishAt = performance.now() + turnDurationMs;
			let rollReady = false;
			let rollStarted = false;
			let rollStartAt = 0;
			let rollFinishAt = 0;

			const startRoll = (): void => {
				if (rollStarted)
					return;

				rollStarted = true;
				void this.#setAnimationById('roll').then(() => {
					if (!this.#currentAction || this.#currentActionId !== 'dodge')
						return;

					this.restart();
					this.setPlaying(true);
					this.turnTo(rollFacing);
					rollStartAt = performance.now();
					const rollDurationMs = this.#resolveCurrentAnimationDurationMs(550);
					const distancePx = requestedDistancePx * this.#resolveCurrentAnimationTravelMultiplier();
					rollFinishAt = rollStartAt + rollDurationMs;
					rollReady = true;
					if (distancePx > 0) {
						const matchedSpeedPxPerSecond = rollDurationMs > 0
							? Math.max(1, distancePx / (rollDurationMs / 1000))
							: this.#resolveAnimationScaledSpeedPxPerSecond(speedPxPerSecond);
						this.#motionController.walkDistance(
							retreatDirection,
							distancePx,
							matchedSpeedPxPerSecond,
							rollFacing,
						);
					}
				});
			};

			return {
				completeWhen: (timestamp) => (
					(timestamp >= turnFinishAt && (startRoll(), true))
					&& rollReady
					&& timestamp >= rollFinishAt
					&& !this.hasActiveHorizontalMotion
					&& !this.hasQueuedMotionCommands
				),
				onCancel: () => {
					this.#returnToIdle();
				},
				onComplete: () => {
					this.#returnToIdle();
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
			this.walkDistance(
				direction,
				distancePx,
				this.#resolveAnimationScaledSpeedPxPerSecond(speedPxPerSecond),
			);

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
			const requestedDistancePx = options?.distancePx ?? 96;
			const speedPxPerSecond = options?.speedPxPerSecond ?? 156;

			await this.#setAnimationById('run');
			this.restart();
			this.turnTo(direction);
			const runCycleDurationMs = this.#resolveCurrentAnimationDurationMs(0);
			const runCycleDistancePx = this.#resolveCurrentAnimationDistancePx(requestedDistancePx);
			const runCycleCount = runCycleDistancePx <= 0
				? 1
				: Math.max(1, Math.ceil(requestedDistancePx / runCycleDistancePx));
			const distancePx = runCycleDistancePx * runCycleCount;
			const finishAt = performance.now() + (runCycleDurationMs * runCycleCount);
			const matchedSpeedPxPerSecond = this.#resolveDistanceMatchedAnimationSpeedPxPerSecond(
				distancePx,
				speedPxPerSecond,
			);
			this.#motionController.walkDistance(
				direction,
				distancePx,
				matchedSpeedPxPerSecond,
			);

			return {
				completeWhen: (timestamp) => (
					timestamp >= finishAt
					&& !this.hasActiveHorizontalMotion
					&& !this.hasQueuedMotionCommands
				),
				onCancel: () => {
					this.#returnToIdle();
				},
				onComplete: () => {
					this.#returnToIdle();
				},
			};
		});
	}

	#startMoveToAction(options: KnightMoveToActionOptions): KnightActionHandle {
		return this.#createAction('moveTo', async () => {
			const targetX = options.targetX;
			const speedPxPerSecond = options.speedPxPerSecond ?? 156;
			const arrivalThreshold = Math.max(0.5, options.arrivalThreshold ?? 0.5);

			await this.#setAnimationById('run');
			this.restart();
			this.turnTo(targetX >= this.screenX ? 1 : -1);
			this.moveToward(
				targetX,
				this.#resolveAnimationScaledSpeedPxPerSecond(speedPxPerSecond),
				arrivalThreshold,
			);

			return {
				completeWhen: () => (
					!this.hasActiveHorizontalMotion
					&& !this.hasQueuedMotionCommands
					&& Math.abs(this.screenX - targetX) <= arrivalThreshold
				),
				onCancel: () => {
					this.#finishRunCancellationToIdle();
				},
				onComplete: () => {
					this.setScreenX(targetX);
					this.#finishRunCancellationToIdle();
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
