import { type CharacterUpdateContext } from '../base/types';
import {
	type KnightActionHandle,
	KnightCharacter,
} from './knight-character';

export type KnightBehaviorId = 'lazy-bursts';

export interface KnightBehaviorModel {
	readonly id:    KnightBehaviorId;
	readonly label: string;

	dispose?(): void;
	getPhaseLabel?(): string;
	update(character: KnightCharacter, timestamp: number, context: CharacterUpdateContext): void;
}

export interface KnightBehaviorDefinition {
	readonly id:    KnightBehaviorId;
	readonly label: string;

	create(): KnightBehaviorModel;
}

interface PlannedKnightAction {
	readonly id: string;

	start(character: KnightCharacter): KnightActionHandle;
}

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

const randomIntBetween = (min: number, max: number): number => Math.round(randomBetween(min, max));

class LazyBurstBehaviorModel implements KnightBehaviorModel {

	readonly id: KnightBehaviorId = 'lazy-bursts';
	readonly label = 'Lazy Bursts';

	#activeActionHandle: KnightActionHandle | null = null;
	#activeActionId:     string | null = null;
	#lastTimestamp = 0;
	#nextBurstAt = 0;
	#pendingActions:     PlannedKnightAction[] = [];
	#phase:              'bursting' | 'resting' = 'resting';

	constructor() {
		this.#scheduleNextBurst(performance.now());
	}

	dispose(): void {
		this.#activeActionHandle?.cancel();
		this.#activeActionHandle = null;
		this.#activeActionId = null;
		this.#pendingActions = [];
	}

	getPhaseLabel(): string {
		if (this.#phase === 'resting')
			return 'resting';

		return this.#activeActionId
			? `bursting:${ this.#activeActionId }`
			: 'bursting';
	}

	update(character: KnightCharacter, timestamp: number, context: CharacterUpdateContext): void {
		this.#lastTimestamp = timestamp;

		if (this.#activeActionHandle || character.hasActiveAction)
			return;

		if (this.#pendingActions.length === 0) {
			if (this.#phase === 'resting' && timestamp < this.#nextBurstAt)
				return;

			this.#phase = 'bursting';
			this.#pendingActions = this.#buildBurstPlan(character, context);
		}

		this.#startNextAction(character);
	}

	#buildBurstPlan(character: KnightCharacter, context: CharacterUpdateContext): PlannedKnightAction[] {
		const plannedActions: PlannedKnightAction[] = [];
		const burstSteps = randomIntBetween(3, 6);

		for (let index = 0; index < burstSteps; index += 1) {
			const direction = this.#chooseDirection(character);
			const roll = Math.random();

			if (roll < 0.5) {
				const distancePx = Math.min(
					randomIntBetween(48, 144),
					Math.max(32, Math.round(context.viewportWidth * 0.18)),
				);

				plannedActions.push({
					id:    direction < 0 ? 'moveLeft' : 'moveRight',
					start: (nextCharacter) => direction < 0
						? nextCharacter.actions.moveLeft({
							distancePx,
							speedPxPerSecond: randomIntBetween(116, 172),
						})
						: nextCharacter.actions.moveRight({
							distancePx,
							speedPxPerSecond: randomIntBetween(116, 172),
						}),
				});

				continue;
			}

			if (roll < 0.85) {
				plannedActions.push({
					id:    'jump',
					start: (nextCharacter) => nextCharacter.actions.jump({
						deltaX:     direction * randomIntBetween(28, 84),
						durationMs: randomIntBetween(600, 860),
						facing:     direction,
						peakHeight: randomIntBetween(28, 54),
					}),
				});

				continue;
			}

			plannedActions.push({
				id:    'turn',
				start: (nextCharacter) => nextCharacter.actions.turn({
					direction,
					durationMs: randomIntBetween(320, 520),
				}),
			});
		}

		plannedActions.push({
			id:    'die',
			start: (nextCharacter) => nextCharacter.actions.die(),
		});

		return plannedActions;
	}

	#chooseDirection(character: KnightCharacter): -1 | 1 {
		const leftRoom = character.screenX - character.minScreenX;
		const rightRoom = character.maxScreenX - character.screenX;

		if (leftRoom < 72)
			return 1;

		if (rightRoom < 72)
			return -1;

		return Math.random() < 0.5 ? -1 : 1;
	}

	#scheduleNextBurst(baseTimestamp: number): void {
		this.#nextBurstAt = baseTimestamp + randomBetween(5000, 14000);
	}

	#settleRestState(): void {
		this.#phase = 'resting';
		this.#pendingActions = [];
		this.#scheduleNextBurst(this.#lastTimestamp || performance.now());
	}

	#startNextAction(character: KnightCharacter): void {
		const nextAction = this.#pendingActions.shift();
		if (!nextAction) {
			this.#settleRestState();

			return;
		}

		this.#activeActionId = nextAction.id;
		const actionHandle = nextAction.start(character);
		this.#activeActionHandle = actionHandle;

		void actionHandle.finished.then((completed) => {
			if (this.#activeActionHandle !== actionHandle)
				return;

			this.#activeActionHandle = null;

			if (!completed) {
				this.#activeActionId = null;
				this.#settleRestState();

				return;
			}

			if (nextAction.id === 'die') {
				this.#activeActionId = null;
				this.#settleRestState();

				return;
			}

			this.#startNextAction(character);
		});
	}

}

export const knightBehaviorDefinitions: readonly KnightBehaviorDefinition[] = [
	{
		create: () => new LazyBurstBehaviorModel(),
		id:     'lazy-bursts',
		label:  'Lazy Bursts',
	},
];

const knightBehaviorDefinitionMap: ReadonlyMap<KnightBehaviorId, KnightBehaviorDefinition> = new Map(
	knightBehaviorDefinitions.map((definition) => [ definition.id, definition ]),
);

export const createKnightBehaviorModel = (behaviorId: KnightBehaviorId): KnightBehaviorModel => {
	const definition = knightBehaviorDefinitionMap.get(behaviorId);
	if (!definition)
		throw new Error(`Unknown knight behavior model: ${ behaviorId }.`);

	return definition.create();
};
