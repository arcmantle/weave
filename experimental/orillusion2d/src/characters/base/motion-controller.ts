export interface CharacterMotionAdapter {
	readonly screenX: number;

	moveScreenX(deltaX: number): void;
	setFacing(facing: -1 | 1): void;
	setMotionOffsetY(offsetY: number): void;
	setScreenX(screenX: number): void;
}

export interface CharacterMotionFrame<TContext = void> {
	context:   TContext;
	timestamp: number;
}

export type CharacterMotionCondition<TContext = void> = (
	frame: CharacterMotionFrame<TContext>,
) => boolean;

export interface InterruptibleMotionOptions<TContext = void> {
	interruptWhen?: CharacterMotionCondition<TContext>;
}

export type CharacterMotionCommand<TContext = void> =
	| {
		facing: -1 | 1;
		type:   'turn';
	}
	| ({
		direction:        -1 | 1;
		distance:         number;
		speedPxPerSecond: number;
		type:             'walk';
	} & InterruptibleMotionOptions<TContext>)
	| ({
		arrivalThreshold?: number;
		speedPxPerSecond:  number;
		targetX:           number;
		type:              'move-to';
	} & InterruptibleMotionOptions<TContext>)
	| ({
		deltaX:     number;
		durationMs: number;
		peakHeight: number;
		type:       'jump';
	} & InterruptibleMotionOptions<TContext>)
	| ({
		durationMs: number;
		type:       'wait';
	} & InterruptibleMotionOptions<TContext>)
	| ({
		maxDurationMs?: number;
		type:           'wait-until';
		when:           CharacterMotionCondition<TContext>;
	} & InterruptibleMotionOptions<TContext>)
	| {
		elseCommands?: readonly CharacterMotionCommand<TContext>[];
		thenCommands:  readonly CharacterMotionCommand<TContext>[];
		type:          'branch';
		when:          CharacterMotionCondition<TContext>;
	}
	| {
		type: 'stop';
	};

export const motion = {
	branch<TContext>(
		when: CharacterMotionCondition<TContext>,
		thenCommands: readonly CharacterMotionCommand<TContext>[],
		elseCommands: readonly CharacterMotionCommand<TContext>[] = [],
	): CharacterMotionCommand<TContext> {
		return {
			elseCommands,
			thenCommands,
			type: 'branch',
			when,
		};
	},

	jump<TContext>(
		deltaX: number,
		peakHeight: number,
		durationMs: number,
		options: InterruptibleMotionOptions<TContext> = {},
	): CharacterMotionCommand<TContext> {
		return {
			...options,
			deltaX,
			durationMs,
			peakHeight,
			type: 'jump',
		};
	},

	moveTo<TContext>(
		targetX: number,
		speedPxPerSecond: number,
		arrivalThreshold?: number,
		options: InterruptibleMotionOptions<TContext> = {},
	): CharacterMotionCommand<TContext> {
		return {
			...options,
			arrivalThreshold,
			speedPxPerSecond,
			targetX,
			type: 'move-to',
		};
	},

	stop<TContext = void>(): CharacterMotionCommand<TContext> {
		return { type: 'stop' };
	},

	turn<TContext = void>(facing: -1 | 1): CharacterMotionCommand<TContext> {
		return {
			facing,
			type: 'turn',
		};
	},

	wait<TContext>(
		durationMs: number,
		options: InterruptibleMotionOptions<TContext> = {},
	): CharacterMotionCommand<TContext> {
		return {
			...options,
			durationMs,
			type: 'wait',
		};
	},

	waitUntil<TContext>(
		when: CharacterMotionCondition<TContext>,
		options: ({
			maxDurationMs?: number;
		} & InterruptibleMotionOptions<TContext>) = {},
	): CharacterMotionCommand<TContext> {
		return {
			...options,
			type: 'wait-until',
			when,
		};
	},

	walk<TContext>(
		direction: -1 | 1,
		distance: number,
		speedPxPerSecond: number,
		options: InterruptibleMotionOptions<TContext> = {},
	): CharacterMotionCommand<TContext> {
		return {
			...options,
			direction,
			distance,
			speedPxPerSecond,
			type: 'walk',
		};
	},
};

interface JumpMotion {
	deltaX:     number;
	durationMs: number;
	peakHeight: number;
	startTime:  number | null;
	startX:     number | null;
}

type HorizontalMotion =
	| {
		type:              'distance';
		direction:         -1 | 1;
		remainingDistance: number;
		speedPxPerSecond:  number;
	}
	| {
		type:             'target';
		arrivalThreshold: number;
		targetX:          number;
		speedPxPerSecond: number;
	};

interface WaitMotion<TContext> {
	durationMs?:    number;
	interruptWhen?: CharacterMotionCondition<TContext>;
	startTime:      number | null;
	type:           'until' | 'wait';
	until?:         CharacterMotionCondition<TContext>;
}

interface ActiveCommand<TContext> {
	interruptWhen?: CharacterMotionCondition<TContext>;
	label:          string;
}

export class CharacterMotionController<TContext = void> {

	#horizontalMotion: HorizontalMotion | null = null;
	#jumpMotion:       JumpMotion | null = null;
	#queuedCommands:   CharacterMotionCommand<TContext>[] = [];
	#waitMotion:       WaitMotion<TContext> | null = null;
	#activeCommand:    ActiveCommand<TContext> | null = null;

	get activeCommandLabel(): string | null {
		if (this.#activeCommand)
			return this.#activeCommand.label;

		if (this.#queuedCommands.length > 0)
			return `queued:${ this.#queuedCommands[0]!.type }`;

		return null;
	}

	get hasActiveHorizontalMotion(): boolean {
		return this.#horizontalMotion !== null;
	}

	get hasQueuedCommands(): boolean {
		return this.#queuedCommands.length > 0;
	}

	get isJumping(): boolean {
		return this.#jumpMotion !== null;
	}

	enqueue(commands: readonly CharacterMotionCommand<TContext>[]): void {
		this.#queuedCommands.push(...commands);
	}

	replaceQueue(commands: readonly CharacterMotionCommand<TContext>[], adapter: CharacterMotionAdapter): void {
		this.stop(adapter);
		this.#queuedCommands = [ ...commands ];
	}

	moveToward(targetX: number, speedPxPerSecond: number, arrivalThreshold = 0.5): void {
		if (speedPxPerSecond <= 0) {
			this.#horizontalMotion = null;
			this.#clearActiveCommand();

			return;
		}

		this.#waitMotion = null;
		this.#horizontalMotion = {
			arrivalThreshold,
			speedPxPerSecond,
			targetX,
			type: 'target',
		};
		this.#activeCommand = { label: 'move-to' };
	}

	jump(deltaX: number, peakHeight: number, durationMs: number): void {
		if (durationMs <= 0) {
			this.#jumpMotion = null;
			this.#clearActiveCommand();

			return;
		}

		this.#horizontalMotion = null;
		this.#waitMotion = null;
		this.#jumpMotion = {
			deltaX,
			durationMs,
			peakHeight,
			startTime: null,
			startX:    null,
		};
		this.#activeCommand = { label: 'jump' };
	}

	stop(adapter: CharacterMotionAdapter): void {
		this.#horizontalMotion = null;
		this.#jumpMotion = null;
		this.#queuedCommands = [];
		this.#waitMotion = null;
		this.#clearActiveCommand();
		adapter.setMotionOffsetY(0);
	}

	turnTo(adapter: CharacterMotionAdapter, facing: -1 | 1): void {
		adapter.setFacing(facing);
	}

	update(adapter: CharacterMotionAdapter, timestamp: number, deltaMs: number, context: TContext): void {
		const frame = { context, timestamp };
		this.#drainQueue(adapter, frame);
		if (this.#shouldInterrupt(frame)) {
			this.#interruptActiveMotion(adapter);
			this.#drainQueue(adapter, frame);
		}

		if (this.#jumpMotion) {
			this.#updateJump(adapter, timestamp, frame);

			return;
		}

		if (this.#waitMotion) {
			this.#updateWait(frame);
			this.#drainQueue(adapter, frame);

			return;
		}

		adapter.setMotionOffsetY(0);
		if (!this.#horizontalMotion || deltaMs <= 0) {
			this.#drainQueue(adapter, frame);

			return;
		}

		const deltaSeconds = deltaMs / 1000;
		if (this.#horizontalMotion.type === 'distance') {
			const step = Math.min(
				this.#horizontalMotion.remainingDistance,
				this.#horizontalMotion.speedPxPerSecond * deltaSeconds,
			);

			adapter.setFacing(this.#horizontalMotion.direction);
			adapter.moveScreenX(step * this.#horizontalMotion.direction);
			this.#horizontalMotion.remainingDistance -= step;
			if (this.#horizontalMotion.remainingDistance <= 0.5) {
				this.#horizontalMotion = null;
				this.#clearActiveCommand();
				this.#drainQueue(adapter, frame);
			}

			return;
		}

		const deltaX = this.#horizontalMotion.targetX - adapter.screenX;
		if (Math.abs(deltaX) <= this.#horizontalMotion.arrivalThreshold) {
			adapter.setScreenX(this.#horizontalMotion.targetX);
			this.#horizontalMotion = null;
			this.#clearActiveCommand();
			this.#drainQueue(adapter, frame);

			return;
		}

		const direction = deltaX >= 0 ? 1 : -1;
		const step = Math.min(Math.abs(deltaX), this.#horizontalMotion.speedPxPerSecond * deltaSeconds);
		adapter.setFacing(direction);
		adapter.moveScreenX(step * direction);
	}

	walkDistance(direction: -1 | 1, distance: number, speedPxPerSecond: number): void {
		if (distance <= 0 || speedPxPerSecond <= 0) {
			this.#horizontalMotion = null;
			this.#clearActiveCommand();

			return;
		}

		this.#waitMotion = null;
		this.#horizontalMotion = {
			direction,
			remainingDistance: distance,
			speedPxPerSecond,
			type:              'distance',
		};
		this.#activeCommand = { label: 'walk' };
	}

	#updateJump(
		adapter: CharacterMotionAdapter,
		timestamp: number,
		frame: CharacterMotionFrame<TContext>,
	): void {
		const jumpMotion = this.#jumpMotion;
		if (!jumpMotion)
			return;

		if (jumpMotion.startTime === null || jumpMotion.startX === null) {
			jumpMotion.startTime = timestamp;
			jumpMotion.startX = adapter.screenX;
			if (jumpMotion.deltaX !== 0)
				adapter.setFacing(jumpMotion.deltaX >= 0 ? 1 : -1);
		}

		const progress = Math.min(1, Math.max(0, (timestamp - jumpMotion.startTime) / jumpMotion.durationMs));
		const nextX = jumpMotion.startX + (jumpMotion.deltaX * progress);
		const verticalOffsetY = 4 * jumpMotion.peakHeight * progress * (1 - progress);

		adapter.setScreenX(nextX);
		adapter.setMotionOffsetY(Math.round(verticalOffsetY));

		if (progress >= 1) {
			adapter.setScreenX(jumpMotion.startX + jumpMotion.deltaX);
			adapter.setMotionOffsetY(0);
			this.#jumpMotion = null;
			this.#clearActiveCommand();
			this.#drainQueue(adapter, frame);
		}
	}

	#beginCommand(adapter: CharacterMotionAdapter, command: CharacterMotionCommand<TContext>): boolean {
		switch (command.type) {
		case 'jump':
			this.jump(command.deltaX, command.peakHeight, command.durationMs);
			this.#activeCommand = {
				interruptWhen: command.interruptWhen,
				label:         'jump',
			};

			return true;

		case 'move-to':
			this.moveToward(command.targetX, command.speedPxPerSecond, command.arrivalThreshold ?? 0.5);
			this.#activeCommand = {
				interruptWhen: command.interruptWhen,
				label:         'move-to',
			};

			return true;

		case 'stop':
			this.#horizontalMotion = null;
			this.#jumpMotion = null;
			this.#waitMotion = null;
			this.#clearActiveCommand();
			adapter.setMotionOffsetY(0);

			return false;

		case 'turn':
			this.turnTo(adapter, command.facing);

			return false;

		case 'wait':
			this.#waitMotion = {
				durationMs:    command.durationMs,
				interruptWhen: command.interruptWhen,
				startTime:     null,
				type:          'wait',
			};
			this.#activeCommand = {
				interruptWhen: command.interruptWhen,
				label:         'wait',
			};

			return true;

		case 'wait-until':
			this.#waitMotion = {
				durationMs:    command.maxDurationMs,
				interruptWhen: command.interruptWhen,
				startTime:     null,
				type:          'until',
				until:         command.when,
			};
			this.#activeCommand = {
				interruptWhen: command.interruptWhen,
				label:         'wait-until',
			};

			return true;

		case 'walk':
			this.walkDistance(command.direction, command.distance, command.speedPxPerSecond);
			this.#activeCommand = {
				interruptWhen: command.interruptWhen,
				label:         'walk',
			};

			return true;

		case 'branch':
			return false;
		}
	}

	#drainQueue(adapter: CharacterMotionAdapter, frame: CharacterMotionFrame<TContext>): void {
		let safety = 32;
		while (!this.#horizontalMotion && !this.#jumpMotion && !this.#waitMotion && this.#queuedCommands.length > 0 && safety > 0) {
			safety -= 1;
			const command = this.#queuedCommands.shift();
			if (!command)
				return;

			if (command.type === 'branch') {
				const branchCommands = command.when(frame) ? command.thenCommands : (command.elseCommands ?? []);
				if (branchCommands.length > 0)
					this.#queuedCommands.unshift(...[ ...branchCommands ]);

				continue;
			}

			this.#beginCommand(adapter, command);
		}
	}

	#updateWait(frame: CharacterMotionFrame<TContext>): void {
		const waitMotion = this.#waitMotion;
		if (!waitMotion)
			return;

		if (waitMotion.startTime === null)
			waitMotion.startTime = frame.timestamp;

		if (waitMotion.type === 'until' && waitMotion.until?.(frame)) {
			this.#waitMotion = null;
			this.#clearActiveCommand();

			return;
		}

		if (waitMotion.durationMs !== undefined && (frame.timestamp - waitMotion.startTime) >= waitMotion.durationMs) {
			this.#waitMotion = null;
			this.#clearActiveCommand();
		}
	}

	#interruptActiveMotion(adapter: CharacterMotionAdapter): void {
		this.#horizontalMotion = null;
		this.#jumpMotion = null;
		this.#waitMotion = null;
		this.#clearActiveCommand();
		adapter.setMotionOffsetY(0);
	}

	#shouldInterrupt(frame: CharacterMotionFrame<TContext>): boolean {
		return this.#activeCommand?.interruptWhen?.(frame) ?? false;
	}

	#clearActiveCommand(): void {
		if (this.#horizontalMotion || this.#jumpMotion || this.#waitMotion)
			return;

		this.#activeCommand = null;
	}

}
