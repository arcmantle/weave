import {
	KNIGHT_FRAME_HEIGHT,
	KNIGHT_FRAME_WIDTH,
	knightAnimationMap,
} from '../characters/knight/animation-manifest';
import {
	type KnightActionHandle,
	KnightCharacter,
} from '../characters/knight/knight-character';
import {
	type Hitbox,
	resolveKnightBodyHitbox,
	SPRITE_SCALE_FALLBACK,
} from './hitboxes';

type FighterSide = 'left' | 'right';
type CombatState = 'advancing' | 'cooldown' | 'dead' | 'dodging' | 'dying' | 'idle' | 'staggered';

interface KnightAttackProfile {
	activeEndRatio:   number;
	activeStartRatio: number;
	cooldownMs:       number;
	damage:           number;
	id:               'attack' | 'attackCombo';
	reachPx:          number;
	widthPx:          number;

	perform(character: KnightCharacter): KnightActionHandle;
}

interface ActiveAttack {
	endsAt:        number;
	hitEndAt:      number;
	hitRegistered: boolean;
	hitStartAt:    number;
	profile:       KnightAttackProfile;

	handle: KnightActionHandle;
}

export interface AttackWindow {
	damage: number;
	hitbox: Hitbox;
}

export interface KnightCombatantStatus {
	attackId?:     string;
	currentHealth: number;
	id:            string;
	isDead:        boolean;
	positionX:     number;
	side:          FighterSide;
	state:         CombatState;
	maxHealth:     number;
}

const DEFAULT_HEALTH = 5;
const DODGE_CHANCE = 0.28;
const DODGE_DISTANCE_PX = 96;
const DODGE_RECOVERY_MS = 180;
const MOVE_ARRIVAL_THRESHOLD_PX = 6;
const MOVE_SPEED_PX_PER_SECOND = 156;
const STAGGER_DURATION_MS = 380;

const resolveAnimationDurationMs = (animationId: string): number => {
	const definition = knightAnimationMap.get(animationId);
	if (!definition)
		throw new Error(`Knight animation ${ animationId } is missing.`);

	const frameCount = animationId === 'attackComboNoMovement' ? 10 : 4;

	return Math.round((frameCount / definition.fps) * 1000);
};

const attackProfiles: readonly KnightAttackProfile[] = [
	{
		activeEndRatio:   0.62,
		activeStartRatio: 0.25,
		cooldownMs:       420,
		damage:           1,
		id:               'attack',
		reachPx:          68,
		widthPx:          70,
		perform:          (character) => character.actions.attack(),
	},
	{
		activeEndRatio:   0.74,
		activeStartRatio: 0.28,
		cooldownMs:       600,
		damage:           2,
		id:               'attackCombo',
		reachPx:          78,
		widthPx:          84,
		perform:          (character) => character.actions.attackCombo(),
	},
] as const;

const attackDurationMap: Readonly<Record<KnightAttackProfile['id'], number>> = Object.freeze({
	attack:      resolveAnimationDurationMs('attackNoMovement'),
	attackCombo: resolveAnimationDurationMs('attackComboNoMovement'),
});

const randomAttackProfile = (): KnightAttackProfile => attackProfiles[Math.floor(Math.random() * attackProfiles.length)]!;

export class KnightCombatant {

	readonly character: KnightCharacter;
	readonly id:        string;
	readonly maxHealth: number;
	readonly side:      FighterSide;

	#activeAttack:  ActiveAttack | null = null;
	#currentHealth: number;
	#nextActionAt = 0;
	#state:         CombatState = 'idle';

	constructor(character: KnightCharacter, side: FighterSide, maxHealth: number = DEFAULT_HEALTH) {
		this.character = character;
		this.id = character.id;
		this.side = side;
		this.maxHealth = maxHealth;
		this.#currentHealth = maxHealth;
		this.character.turnTo(side === 'left' ? 1 : -1);
	}

	get currentHealth(): number {
		return this.#currentHealth;
	}

	get isDead(): boolean {
		return this.#state === 'dead' || this.#state === 'dying';
	}

	get isDying(): boolean {
		return this.#state === 'dying';
	}

	get positionX(): number {
		return this.character.screenX;
	}

	get state(): CombatState {
		return this.#state;
	}

	get status(): KnightCombatantStatus {
		return {
			attackId:      this.#activeAttack?.profile.id,
			currentHealth: this.#currentHealth,
			id:            this.id,
			isDead:        this.isDead,
			maxHealth:     this.maxHealth,
			positionX:     this.positionX,
			side:          this.side,
			state:         this.#state,
		};
	}

	advanceToward(targetX: number, timestamp: number): void {
		this.#refreshAttackState(timestamp);
		if (this.isDead || this.character.hasActiveAction)
			return;

		this.character.runToward(targetX, MOVE_SPEED_PX_PER_SECOND, MOVE_ARRIVAL_THRESHOLD_PX);

		this.#state = 'advancing';
	}

	canAct(timestamp: number): boolean {
		if (this.isDead)
			return false;

		this.#refreshAttackState(timestamp);

		return !this.character.hasActiveAction && timestamp >= this.#nextActionAt;
	}

	getAttackWindow(timestamp: number): AttackWindow | null {
		this.#refreshAttackState(timestamp);
		if (!this.#activeAttack)
			return null;

		if (timestamp < this.#activeAttack.hitStartAt || timestamp > this.#activeAttack.hitEndAt)
			return null;

		if (this.#activeAttack.hitRegistered)
			return null;

		const scale = this.character.spriteScale ?? SPRITE_SCALE_FALLBACK;
		const facing = this.character.facing;
		const attackCenterX = this.positionX + (facing * this.#activeAttack.profile.reachPx * (scale / SPRITE_SCALE_FALLBACK));
		const attackWidth = this.#activeAttack.profile.widthPx * (scale / SPRITE_SCALE_FALLBACK);
		const bodyHitbox = this.getBodyHitbox();

		return {
			damage: this.#activeAttack.profile.damage,
			hitbox: {
				centerX: attackCenterX,
				centerY: bodyHitbox.centerY,
				height:  bodyHitbox.height * 0.72,
				width:   attackWidth,
			},
		};
	}

	getBodyHitbox(): Hitbox {
		return resolveKnightBodyHitbox(this.character);
	}

	markAttackHit(): void {
		if (this.#activeAttack)
			this.#activeAttack.hitRegistered = true;
	}

	receiveHit(timestamp: number, damage: number): void {
		if (this.isDead)
			return;

		if (this.#tryDodge(timestamp))
			return;

		this.#activeAttack = null;
		this.#currentHealth = Math.max(0, this.#currentHealth - damage);
		if (this.#currentHealth <= 0) {
			this.#state = 'dying';
			this.#nextActionAt = Number.POSITIVE_INFINITY;
			const deathHandle = this.character.actions.die();
			void deathHandle.finished.then(() => {
				this.#state = 'dead';
			});

			return;
		}

		this.#state = 'staggered';
		this.#nextActionAt = timestamp + STAGGER_DURATION_MS;
		void this.character.actions.hit().finished.then(() => {
			if (this.#state === 'staggered')
				this.#state = 'cooldown';
		});
	}

	resetToIdle(): void {
		if (this.isDead)
			return;

		this.character.stopRunning();
		this.#state = 'idle';
	}

	startAttack(timestamp: number): void {
		if (!this.canAct(timestamp))
			return;

		const profile = randomAttackProfile();
		this.character.turnTo(this.side === 'left' ? 1 : -1);
		const handle = profile.perform(this.character);
		const durationMs = attackDurationMap[profile.id];
		this.#activeAttack = {
			endsAt:        timestamp + durationMs,
			handle,
			hitEndAt:      timestamp + (durationMs * profile.activeEndRatio),
			hitRegistered: false,
			hitStartAt:    timestamp + (durationMs * profile.activeStartRatio),
			profile,
		};
		this.#nextActionAt = timestamp + durationMs + profile.cooldownMs;
		this.#state = 'cooldown';

		void handle.finished.then(() => {
			this.#refreshAttackState(performance.now());
			if (!this.isDead && this.#state === 'cooldown')
				this.#state = 'idle';
		});
	}

	#tryDodge(timestamp: number): boolean {
		if (Math.random() >= DODGE_CHANCE)
			return false;

		this.#activeAttack = null;
		this.#state = 'dodging';
		this.#nextActionAt = timestamp + DODGE_RECOVERY_MS;
		const handle = this.character.actions.dodge({
			direction:  this.character.facing === 1 ? -1 : 1,
			distancePx: DODGE_DISTANCE_PX,
		});
		void handle.finished.then((completed) => {
			if (!completed || this.isDead)
				return;

			if (this.#state === 'dodging')
				this.#state = performance.now() >= this.#nextActionAt ? 'idle' : 'cooldown';
		});

		return true;
	}

	#refreshAttackState(timestamp: number): void {
		if (this.#activeAttack && timestamp >= this.#activeAttack.endsAt)
			this.#activeAttack = null;
	}

}

export type { FighterSide };
