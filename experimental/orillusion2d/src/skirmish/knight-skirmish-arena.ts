import { type CharacterUpdateContext } from '../characters/base/types';
import { knightAnimationMap } from '../characters/knight/animation-manifest';
import {
	OrillusionKnightViewer,
	type SpawnCharacterOptions,
	type ViewerSystem,
} from '../orillusion-viewer';
import { hitboxesIntersect } from './hitboxes';
import { KnightCombatant, type KnightCombatantStatus } from './knight-combatant';

export interface KnightSkirmishArenaStatus {
	left?:     KnightCombatantStatus;
	right?:    KnightCombatantStatus;
	round:     number;
	phase:     'combat' | 'respawning' | 'spawning';
	summary:   string;
	winner?:   'left' | 'right' | 'stalemate';
	distance?: number;
}

interface KnightSkirmishArenaOptions {
	onStatusChange?(status: KnightSkirmishArenaStatus): void;
	respawnDelayMs?: number;
	corpseHoldMs?:   number;
}

const DEFAULT_CORPSE_HOLD_MS = 1800;
const DEFAULT_RESPAWN_DELAY_MS = 1200;
const ENGAGE_DISTANCE_PX = 134;
const ROUND_CLEARANCE_MS = 220;

export class KnightSkirmishArena implements ViewerSystem {

	readonly #corpseHoldMs:   number;
	readonly #onStatusChange: (status: KnightSkirmishArenaStatus) => void;
	readonly #respawnDelayMs: number;

	#left:           KnightCombatant | null = null;
	#lastStatusSummary = '';
	#nextSpawnAt = 0;
	#phase:          KnightSkirmishArenaStatus['phase'] = 'spawning';
	#right:          KnightCombatant | null = null;
	#round = 0;
	#roundResolvedAt = 0;
	#spawnPromise:   Promise<void> | null = null;
	#standingWinner: 'left' | 'right' | null = null;
	#winner:         KnightSkirmishArenaStatus['winner'];

	constructor(options: KnightSkirmishArenaOptions = {}) {
		this.#corpseHoldMs = options.corpseHoldMs ?? DEFAULT_CORPSE_HOLD_MS;
		this.#onStatusChange = options.onStatusChange ?? (() => {});
		this.#respawnDelayMs = options.respawnDelayMs ?? DEFAULT_RESPAWN_DELAY_MS;
	}

	dispose(): void {
		this.#left = null;
		this.#right = null;
		this.#spawnPromise = null;
	}

	update(viewer: OrillusionKnightViewer, timestamp: number, context: CharacterUpdateContext): void {
		if (!this.#left || !this.#right) {
			if (!this.#spawnPromise && timestamp >= this.#nextSpawnAt) {
				this.#spawnPromise = this.#spawnRound(viewer, context)
					.catch((error: unknown) => {
						console.error('Failed to spawn knight skirmish round.', error);
						this.#phase = 'respawning';
						this.#nextSpawnAt = performance.now() + this.#respawnDelayMs;
					})
					.finally(() => {
						this.#spawnPromise = null;
					});
			}

			this.#emitStatus();

			return;
		}

		this.#left.character.turnTo(1);
		this.#right.character.turnTo(-1);

		const distance = Math.abs(this.#right.positionX - this.#left.positionX);
		if (!this.#left.isDead && !this.#right.isDead && distance > ENGAGE_DISTANCE_PX) {
			this.#phase = 'combat';
			this.#advanceCombatants(timestamp);
		}
		else if (!this.#left.isDead && !this.#right.isDead) {
			this.#phase = 'combat';
			this.#left.resetToIdle();
			this.#right.resetToIdle();
			this.#left.startAttack(timestamp);
			this.#right.startAttack(timestamp + 40);
		}

		const leftAttack = this.#left.getAttackWindow(timestamp);
		const rightAttack = this.#right.getAttackWindow(timestamp);
		const leftBody = this.#left.getBodyHitbox();
		const rightBody = this.#right.getBodyHitbox();

		if (leftAttack && hitboxesIntersect(leftAttack.hitbox, rightBody)) {
			this.#left.markAttackHit();
			this.#right.receiveHit(timestamp, leftAttack.damage);
		}

		if (rightAttack && hitboxesIntersect(rightAttack.hitbox, leftBody)) {
			this.#right.markAttackHit();
			this.#left.receiveHit(timestamp, rightAttack.damage);
		}

		this.#cleanupRound(viewer, timestamp);
		this.#emitStatus(distance);
	}

	#cleanupRound(viewer: OrillusionKnightViewer, timestamp: number): void {
		if (!this.#left || !this.#right)
			return;

		const leftDead = this.#left.isDead;
		const rightDead = this.#right.isDead;
		if (!leftDead && !rightDead) {
			this.#winner = undefined;

			return;
		}

		if (this.#roundResolvedAt === 0)
			this.#roundResolvedAt = timestamp + ROUND_CLEARANCE_MS;

		if (timestamp < this.#roundResolvedAt + this.#corpseHoldMs)
			return;

		this.#winner = leftDead && rightDead
			? 'stalemate'
			: leftDead
				? 'right'
				: 'left';
		if (leftDead && rightDead) {
			viewer.removeCharacter(this.#left.id);
			viewer.removeCharacter(this.#right.id);
			this.#left = null;
			this.#right = null;
			this.#standingWinner = null;
		}
		else if (leftDead) {
			viewer.removeCharacter(this.#left.id);
			this.#left = null;
			this.#standingWinner = 'right';
			this.#right.resetToIdle();
		}
		else {
			viewer.removeCharacter(this.#right.id);
			this.#right = null;
			this.#standingWinner = 'left';
			this.#left.resetToIdle();
		}

		this.#phase = 'respawning';
		this.#nextSpawnAt = timestamp + this.#respawnDelayMs;
		this.#roundResolvedAt = 0;
	}

	#emitStatus(distance?: number): void {
		const status: KnightSkirmishArenaStatus = {
			left:    this.#left?.status,
			phase:   this.#phase,
			right:   this.#right?.status,
			round:   this.#round,
			summary: this.#buildSummary(distance),
			winner:  this.#winner,
			distance,
		};

		if (status.summary === this.#lastStatusSummary)
			return;

		this.#lastStatusSummary = status.summary;
		this.#onStatusChange(status);
	}

	#buildSummary(distance?: number): string {
		const left = this.#left?.status;
		const right = this.#right?.status;
		if (!left || !right) {
			const countdownSeconds = Math.max(0, Math.ceil((this.#nextSpawnAt - performance.now()) / 1000));
			if (this.#phase === 'respawning') {
				if (left)
					return `Round ${ this.#round }\nLeft knight holds ground with ${ left.currentHealth } HP. Next challenger in ${ countdownSeconds }s.`;

				if (right)
					return `Round ${ this.#round }\nRight knight holds ground with ${ right.currentHealth } HP. Next challenger in ${ countdownSeconds }s.`;

				return `Arena resetting. Next round in ${ countdownSeconds }s.`;
			}

			return 'Spawning duelists.';
		}

		const rangeLabel = distance === undefined ? 'n/a' : `${ Math.round(distance) }px`;
		const winnerLabel = this.#winner ? ` Winner: ${ this.#winner }.` : '';

		return [
			`Round ${ this.#round }`,
			`Left HP ${ left.currentHealth }/${ left.maxHealth } (${ left.state })`,
			`Right HP ${ right.currentHealth }/${ right.maxHealth } (${ right.state })`,
			`Distance ${ rangeLabel }.${ winnerLabel }`,
		].join('\n');
	}

	#advanceCombatants(timestamp: number): void {
		if (!this.#left || !this.#right)
			return;

		if (this.#standingWinner === 'left') {
			this.#left.resetToIdle();
			this.#right.advanceToward(this.#left.positionX + ENGAGE_DISTANCE_PX, timestamp);

			return;
		}

		if (this.#standingWinner === 'right') {
			this.#right.resetToIdle();
			this.#left.advanceToward(this.#right.positionX - ENGAGE_DISTANCE_PX, timestamp);

			return;
		}

		const midpointX = (this.#left.positionX + this.#right.positionX) / 2;
		this.#left.advanceToward(midpointX - (ENGAGE_DISTANCE_PX / 2), timestamp);
		this.#right.advanceToward(midpointX + (ENGAGE_DISTANCE_PX / 2), timestamp);
	}

	async #spawnRound(viewer: OrillusionKnightViewer, context: CharacterUpdateContext): Promise<void> {
		this.#phase = 'spawning';
		const leftExists = this.#left !== null;
		const rightExists = this.#right !== null;
		this.#round += 1;
		const idleAnimation = knightAnimationMap.get('idle');
		if (!idleAnimation)
			throw new Error('Knight idle animation is missing.');

		if (!leftExists) {
			const leftSpawn: SpawnCharacterOptions = {
				animation:   idleAnimation,
				id:          `left-knight-${ this.#round }`,
				screenX:     Math.round(-context.viewportWidth * 0.5),
				spriteScale: 4,
			};
			const leftId = await viewer.spawnCharacter(leftSpawn);
			const leftCharacter = viewer.getCharacter(leftId);
			if (!leftCharacter)
				throw new Error('Failed to initialize left knight combatant.');

			leftCharacter.setScreenX(leftCharacter.minScreenX);
			this.#left = new KnightCombatant(leftCharacter, 'left');
		}

		if (!rightExists) {
			const rightSpawn: SpawnCharacterOptions = {
				animation:   idleAnimation,
				id:          `right-knight-${ this.#round }`,
				screenX:     Math.round(context.viewportWidth * 0.5),
				spriteScale: 4,
			};
			const rightId = await viewer.spawnCharacter(rightSpawn);
			const rightCharacter = viewer.getCharacter(rightId);
			if (!rightCharacter)
				throw new Error('Failed to initialize right knight combatant.');

			rightCharacter.setScreenX(rightCharacter.maxScreenX);
			this.#right = new KnightCombatant(rightCharacter, 'right');
		}

		this.#winner = undefined;
		this.#phase = 'combat';
	}

}
