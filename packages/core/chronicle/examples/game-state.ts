/**
 * Game State Example
 *
 * Demonstrates:
 * - Time-travel debugging
 * - Complex nested state
 * - History markers
 * - Pause/resume for batch updates
 */

import { chronicle } from '../src/chronicle.ts';

interface Position {
	x: number;
	y: number;
}

interface Player {
	id:        number;
	name:      string;
	position:  Position;
	health:    number;
	score:     number;
	inventory: string[];
}

interface Enemy {
	id:       number;
	type:     string;
	position: Position;
	health:   number;
}

interface GameState {
	players:  Player[];
	enemies:  Enemy[];
	level:    number;
	score:    number;
	isPaused: boolean;
	gameOver: boolean;
}

// Create game state
const gameState: GameState = chronicle<GameState>({
	players: [
		{
			id:        1,
			name:      'Player 1',
			position:  { x: 0, y: 0 },
			health:    100,
			score:     0,
			inventory: [],
		},
	],
	enemies:  [],
	level:    1,
	score:    0,
	isPaused: false,
	gameOver: false,
});

// Configure for game needs
chronicle.configure(gameState, {
	maxHistory: 1000, // Keep lots of history for time-travel
	filter:     (record) => {
		// Don't record position micr o-updates (too noisy)
		const path = record.path.join('.');

		return !path.endsWith('.position.x') && !path.endsWith('.position.y');
	},
});

// Track important game events
const gameCheckpoints: number[] = [];

function saveCheckpoint(): void {
	const marker = chronicle.mark(gameState);
	gameCheckpoints.push(marker);
	console.log(`💾 Checkpoint saved (${ gameCheckpoints.length })`);
}

function loadCheckpoint(index: number): void {
	if (index >= 0 && index < gameCheckpoints.length) {
		chronicle.undoSince(gameState, gameCheckpoints[index]!);
		console.log(`⏮️  Loaded checkpoint ${ index + 1 }`);
	}
}

// Game actions
function movePlayer(playerId: number, dx: number, dy: number): void {
	const player = gameState.players.find(p => p.id === playerId);
	if (player && !gameState.isPaused) {
		// Batch position update to make it atomic
		chronicle.batch(gameState, (state) => {
			player.position.x += dx;
			player.position.y += dy;
		});
	}
}

function addEnemy(type: string, x: number, y: number): void {
	chronicle.batch(gameState, (state) => {
		state.enemies.push({
			id:       Date.now(),
			type,
			position: { x, y },
			health:   50,
		});
	});
}

function attackEnemy(playerId: number, enemyId: number, damage: number): void {
	chronicle.batch(gameState, (state) => {
		const enemy = state.enemies.find(e => e.id === enemyId);
		const player = state.players.find(p => p.id === playerId);

		if (enemy && player) {
			enemy.health -= damage;

			if (enemy.health <= 0) {
				// Enemy defeated
				const index = state.enemies.findIndex(e => e.id === enemyId);
				state.enemies.splice(index, 1);
				player.score += 100;
				state.score += 100;
				console.log(`⚔️  Enemy defeated! +100 points`);
			}
		}
	});
}

function collectItem(playerId: number, item: string): void {
	const player = gameState.players.find(p => p.id === playerId);
	if (player) {
		chronicle.batch(gameState, (state) => {
			player.inventory.push(item);
			player.score += 50;
			state.score += 50;
			console.log(`📦 Collected: ${ item }`);
		});
	}
}

function takeDamage(playerId: number, damage: number): void {
	const player = gameState.players.find(p => p.id === playerId);
	if (player) {
		player.health -= damage;
		if (player.health <= 0) {
			gameState.gameOver = true;
			console.log('💀 Game Over!');
		}
	}
}

function nextLevel(): void {
	chronicle.batch(gameState, (state) => {
		state.level++;
		state.enemies = [];
		// Heal players
		state.players.forEach(p => {
			p.health = Math.min(100, p.health + 20);
		});
		console.log(`🎮 Level ${ state.level } started!`);
	});
	saveCheckpoint();
}

// Pause game updates (queues changes)
function pauseGame(): void {
	gameState.isPaused = true;
	chronicle.pause(gameState);
	console.log('⏸️  Game paused');
}

function resumeGame(): void {
	gameState.isPaused = false;
	chronicle.resume(gameState);
	console.log('▶️  Game resumed');
}

// Time-travel debugging
function rewindTime(steps: number = 1): void {
	chronicle.undoGroups(gameState, steps);
	console.log(`⏪ Rewound ${ steps } step(s)`);
}

function fastForward(steps: number = 1): void {
	chronicle.redoGroups(gameState, steps);
	console.log(`⏩ Fast-forwarded ${ steps } step(s)`);
}

// Demo gameplay
console.log('=== Game State Demo ===\n');

saveCheckpoint(); // Initial checkpoint

// Player actions
movePlayer(1, 10, 5);
collectItem(1, 'Health Potion');
collectItem(1, 'Sword');

// Spawn enemies
addEnemy('goblin', 20, 10);
addEnemy('goblin', 30, 15);

// Combat
attackEnemy(1, gameState.enemies[0]!.id, 30);
attackEnemy(1, gameState.enemies[0]!.id, 30); // Defeat first enemy

console.log(`\n📊 Player Stats:`);
console.log(`  Health: ${ gameState.players[0]!.health }`);
console.log(`  Score: ${ gameState.players[0]!.score }`);
console.log(`  Inventory: ${ gameState.players[0]!.inventory.join(', ') }`);
console.log(`  Enemies remaining: ${ gameState.enemies.length }`);

// Test time-travel
console.log('\n⏰ Time Travel:');
rewindTime(2); // Undo last 2 actions
console.log(`  Enemies after rewind: ${ gameState.enemies.length }`);
console.log(`  Score after rewind: ${ gameState.players[0]!.score }`);

fastForward(2); // Redo
console.log(`  Enemies after fast-forward: ${ gameState.enemies.length }`);

// Test checkpoint system
console.log('\n💾 Checkpoint System:');
nextLevel();
addEnemy('dragon', 50, 50);
console.log(`  Current level: ${ gameState.level }`);
console.log(`  Enemies: ${ gameState.enemies.length }`);

loadCheckpoint(0); // Back to start
console.log(`  After loading first checkpoint:`);
console.log(`  Level: ${ gameState.level }`);
console.log(`  Enemies: ${ gameState.enemies.length }`);
console.log(`  Inventory: ${ gameState.players[0]!.inventory.join(', ') || 'empty' }`);

export {
	addEnemy,
	attackEnemy,
	collectItem,
	fastForward,
	gameState,
	loadCheckpoint,
	movePlayer,
	nextLevel,
	pauseGame,
	resumeGame,
	rewindTime,
	saveCheckpoint,
	takeDamage,
};
