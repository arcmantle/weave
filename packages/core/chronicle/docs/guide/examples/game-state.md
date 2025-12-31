---
title: 'Example: Game State Management'
description: Complete game state manager with save/load, checkpoints, and replay functionality
keywords: example, game, state management, save, load, checkpoints, replay, undo
---

# Example: Game State Management

Build a complete game state manager with save/load, checkpoints, and replay functionality using Chronicle.

## Overview

This example demonstrates:

- 🎮 Complete game state tracking
- 💾 Save/load game functionality
- 📍 Checkpoint system
- 🔄 Replay and time-travel
- ⏸️ Pause/resume mechanics
- 📊 Statistics tracking
- 🏆 Achievement system

## Complete Implementation

### Type Definitions

```typescript
import { chronicle, ChronicleProxy } from '@arcmantle/chronicle';

interface Vector2 {
  x: number;
  y: number;
}

interface Player {
  id: string;
  position: Vector2;
  velocity: Vector2;
  health: number;
  maxHealth: number;
  score: number;
  inventory: Map<string, number>;
  abilities: string[];
}

interface Enemy {
  id: string;
  type: string;
  position: Vector2;
  health: number;
  damage: number;
}

interface GameState {
  player: Player;
  enemies: Enemy[];
  level: number;
  gameTime: number;
  isPaused: boolean;
  checkpoints: Map<string, any>;
  statistics: {
    enemiesDefeated: number;
    damageTaken: number;
    itemsCollected: number;
    deaths: number;
  };
}
```

### State Initialization

```typescript
function createInitialState(): GameState {
  return {
    player: {
      id: 'player-1',
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      health: 100,
      maxHealth: 100,
      score: 0,
      inventory: new Map(),
      abilities: ['dash', 'jump'],
    },
    enemies: [],
    level: 1,
    gameTime: 0,
    isPaused: false,
    checkpoints: new Map(),
    statistics: {
      enemiesDefeated: 0,
      damageTaken: 0,
      itemsCollected: 0,
      deaths: 0,
    },
  };
}

const game = chronicle(createInitialState(), {
  maxHistory: 1000, // Keep long history for replays
  filter: (path) => {
    // Don't track every frame of gameTime in history
    return path[0] !== 'gameTime';
  },
});
```

### Player Actions

```typescript
// Move player
function movePlayer(dx: number, dy: number): void {
  game.player.position.x += dx;
  game.player.position.y += dy;
}

// Update velocity (for physics)
function setPlayerVelocity(vx: number, vy: number): void {
  game.player.velocity.x = vx;
  game.player.velocity.y = vy;
}

// Take damage
function playerTakeDamage(amount: number): void {
  chronicle.batch(game, () => {
    game.player.health = Math.max(0, game.player.health - amount);
    game.statistics.damageTaken += amount;

    if (game.player.health === 0) {
      handlePlayerDeath();
    }
  });
}

// Heal player
function healPlayer(amount: number): void {
  game.player.health = Math.min(
    game.player.maxHealth,
    game.player.health + amount
  );
}

// Add to inventory
function addItem(itemId: string, quantity = 1): void {
  const current = game.player.inventory.get(itemId) || 0;
  game.player.inventory.set(itemId, current + quantity);
  game.statistics.itemsCollected += quantity;
}

// Use item
function useItem(itemId: string): boolean {
  const quantity = game.player.inventory.get(itemId) || 0;
  if (quantity === 0) return false;

  game.player.inventory.set(itemId, quantity - 1);
  return true;
}
```

### Enemy Management

```typescript
// Spawn enemy
function spawnEnemy(type: string, position: Vector2): string {
  const enemy: Enemy = {
    id: crypto.randomUUID(),
    type,
    position: { ...position },
    health: 50,
    damage: 10,
  };

  game.enemies.push(enemy);
  return enemy.id;
}

// Damage enemy
function damageEnemy(enemyId: string, amount: number): void {
  const enemy = game.enemies.find((e) => e.id === enemyId);
  if (!enemy) return;

  chronicle.batch(game, () => {
    enemy.health -= amount;

    if (enemy.health <= 0) {
      killEnemy(enemyId);
    }
  });
}

// Remove enemy
function killEnemy(enemyId: string): void {
  const index = game.enemies.findIndex((e) => e.id === enemyId);
  if (index === -1) return;

  chronicle.batch(game, () => {
    game.enemies.splice(index, 1);
    game.statistics.enemiesDefeated++;
    game.player.score += 100;
  });
}
```

### Checkpoint System

```typescript
// Create checkpoint
function createCheckpoint(name?: string): string {
  const checkpointName = name || `checkpoint-${Date.now()}`;
  const snapshot = chronicle.snapshot(game);

  game.checkpoints.set(checkpointName, {
    snapshot,
    timestamp: Date.now(),
    level: game.level,
    score: game.player.score,
  });

  return checkpointName;
}

// Load checkpoint
function loadCheckpoint(name: string): boolean {
  const checkpoint = game.checkpoints.get(name);
  if (!checkpoint) return false;

  // Restore entire game state
  const restored = chronicle(checkpoint.snapshot);

  chronicle.batch(game, () => {
    // Copy all properties
    game.player = restored.player;
    game.enemies = restored.enemies;
    game.level = restored.level;
    game.gameTime = restored.gameTime;
    game.statistics = restored.statistics;
  });

  return true;
}

// Auto-checkpoint at level start
chronicle.on(game, 'level', () => {
  createCheckpoint(`level-${game.level}`);
}, { mode: 'exact' });
```

### Save/Load System

```typescript
// Save game to localStorage
function saveGame(slot = 'auto-save'): void {
  const saveData = {
    snapshot: chronicle.snapshot(game),
    timestamp: Date.now(),
    metadata: {
      level: game.level,
      score: game.player.score,
      health: game.player.health,
      playtime: game.gameTime,
    },
  };

  localStorage.setItem(`game-save-${slot}`, JSON.stringify(saveData));
}

// Load game from localStorage
function loadGame(slot = 'auto-save'): boolean {
  const savedData = localStorage.getItem(`game-save-${slot}`);
  if (!savedData) return false;

  try {
    const saveData = JSON.parse(savedData);
    const restored = chronicle(saveData.snapshot);

    chronicle.batch(game, () => {
      Object.assign(game, restored);
    });

    return true;
  } catch (error) {
    console.error('Failed to load save:', error);
    return false;
  }
}

// List all saves
function listSaves(): Array<{ slot: string; metadata: any }> {
  const saves = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('game-save-')) {
      const slot = key.replace('game-save-', '');
      const data = JSON.parse(localStorage.getItem(key)!);
      saves.push({ slot, metadata: data.metadata });
    }
  }

  return saves;
}

// Auto-save every 30 seconds
let autoSaveInterval = setInterval(() => {
  if (!game.isPaused) {
    saveGame('auto-save');
  }
}, 30000);
```

### Replay System

```typescript
// Start recording replay
let replayRecording: any[] = [];
let isRecording = false;

function startReplayRecording(): void {
  replayRecording = [];
  isRecording = true;

  const unsubscribe = chronicle.on(game, '', (event) => {
    replayRecording.push({
      timestamp: Date.now(),
      path: event.path,
      value: event.value,
      oldValue: event.oldValue,
    });
  }, { mode: 'down' });

  // Store unsubscribe function
  (startReplayRecording as any).stop = unsubscribe;
}

function stopReplayRecording(): any[] {
  isRecording = false;
  if ((startReplayRecording as any).stop) {
    (startReplayRecording as any).stop();
  }
  return replayRecording;
}

// Playback replay
async function playbackReplay(recording: any[], speed = 1): Promise<void> {
  const startSnapshot = chronicle.snapshot(game);

  for (let i = 0; i < recording.length; i++) {
    const event = recording[i];
    const nextEvent = recording[i + 1];

    // Apply change
    let target: any = game;
    for (let j = 0; j < event.path.length - 1; j++) {
      target = target[event.path[j]];
    }
    target[event.path[event.path.length - 1]] = event.value;

    // Wait for next event
    if (nextEvent) {
      const delay = (nextEvent.timestamp - event.timestamp) / speed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
```

### Game Loop Integration

```typescript
let lastFrameTime = 0;

function gameLoop(currentTime: number): void {
  if (game.isPaused) {
    requestAnimationFrame(gameLoop);
    return;
  }

  const deltaTime = (currentTime - lastFrameTime) / 1000; // seconds
  lastFrameTime = currentTime;

  // Update game time (not tracked in history)
  game.gameTime += deltaTime;

  // Physics update (batched for performance)
  chronicle.batch(game, () => {
    // Update player position based on velocity
    game.player.position.x += game.player.velocity.x * deltaTime;
    game.player.position.y += game.player.velocity.y * deltaTime;

    // Update enemies
    game.enemies.forEach((enemy) => {
      // Simple AI: move toward player
      const dx = game.player.position.x - enemy.position.x;
      const dy = game.player.position.y - enemy.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        enemy.position.x += (dx / distance) * 50 * deltaTime;
        enemy.position.y += (dy / distance) * 50 * deltaTime;
      }

      // Check collision with player
      if (distance < 20) {
        playerTakeDamage(enemy.damage * deltaTime);
      }
    });
  });

  requestAnimationFrame(gameLoop);
}

// Start game loop
requestAnimationFrame(gameLoop);
```

### Death & Respawn

```typescript
function handlePlayerDeath(): void {
  chronicle.batch(game, () => {
    game.statistics.deaths++;

    // Load last checkpoint or restart level
    const checkpointName = `level-${game.level}`;
    if (game.checkpoints.has(checkpointName)) {
      loadCheckpoint(checkpointName);
    } else {
      respawnPlayer();
    }
  });
}

function respawnPlayer(): void {
  chronicle.batch(game, () => {
    game.player.health = game.player.maxHealth;
    game.player.position = { x: 0, y: 0 };
    game.enemies = [];
  });
}
```

## UI Integration

### React Example

```typescript
import { useEffect, useState } from 'react';

function GameUI() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = chronicle.on(game, '', () => {
      forceUpdate({});
    }, { mode: 'down', throttleMs: 16 }); // 60fps

    return unsubscribe;
  }, []);

  return (
    <div className="game-ui">
      {/* HUD */}
      <div className="hud">
        <div className="health-bar">
          <div className="health-fill" style={{
            width: `${(game.player.health / game.player.maxHealth) * 100}%`
          }} />
          <span>{game.player.health}/{game.player.maxHealth}</span>
        </div>

        <div className="stats">
          <span>Level: {game.level}</span>
          <span>Score: {game.player.score}</span>
          <span>Time: {Math.floor(game.gameTime)}s</span>
        </div>
      </div>

      {/* Inventory */}
      <div className="inventory">
        {Array.from(game.player.inventory.entries()).map(([item, qty]) => (
          <div key={item} className="inventory-item">
            {item}: {qty}
            <button onClick={() => useItem(item)}>Use</button>
          </div>
        ))}
      </div>

      {/* Game Controls */}
      <div className="controls">
        <button onClick={() => game.isPaused = !game.isPaused}>
          {game.isPaused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={() => saveGame('manual-save')}>
          Save Game
        </button>
        <button onClick={() => createCheckpoint()}>
          Checkpoint
        </button>
        <button onClick={() => chronicle.undo(game)} disabled={!chronicle.canUndo(game)}>
          Undo
        </button>
      </div>

      {/* Statistics */}
      <details>
        <summary>Statistics</summary>
        <ul>
          <li>Enemies Defeated: {game.statistics.enemiesDefeated}</li>
          <li>Damage Taken: {game.statistics.damageTaken}</li>
          <li>Items Collected: {game.statistics.itemsCollected}</li>
          <li>Deaths: {game.statistics.deaths}</li>
        </ul>
      </details>
    </div>
  );
}
```

## Key Features Demonstrated

### 1. Checkpoint System

Save and restore game state at any point:

```typescript
createCheckpoint('boss-fight-start');
// ... fight boss ...
loadCheckpoint('boss-fight-start'); // Try again!
```

### 2. Replay Recording

Record and playback entire game sessions:

```typescript
startReplayRecording();
// ... play game ...
const replay = stopReplayRecording();

// Playback at 2x speed
await playbackReplay(replay, 2);
```

### 3. Time Travel Debugging

Undo/redo for debugging:

```typescript
// Made a mistake in gameplay?
chronicle.undo(game); // Go back
chronicle.undo(game); // Go back further
chronicle.redo(game); // Oops, go forward again
```

## Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Game State', () => {
  beforeEach(() => {
    Object.assign(game, createInitialState());
    chronicle.clearHistory(game);
  });

  it('should damage player', () => {
    playerTakeDamage(30);
    expect(game.player.health).toBe(70);
    expect(game.statistics.damageTaken).toBe(30);
  });

  it('should spawn and kill enemies', () => {
    const id = spawnEnemy('goblin', { x: 100, y: 100 });
    expect(game.enemies).toHaveLength(1);

    killEnemy(id);
    expect(game.enemies).toHaveLength(0);
    expect(game.statistics.enemiesDefeated).toBe(1);
  });

  it('should create and load checkpoints', () => {
    game.player.score = 1000;
    const checkpoint = createCheckpoint('test');

    game.player.score = 0;
    loadCheckpoint(checkpoint);

    expect(game.player.score).toBe(1000);
  });

  it('should save and load game', () => {
    game.level = 5;
    game.player.score = 5000;

    saveGame('test-slot');

    game.level = 1;
    game.player.score = 0;

    loadGame('test-slot');

    expect(game.level).toBe(5);
    expect(game.player.score).toBe(5000);
  });
});
```

## Next Steps

- [Data Table](./data-table) - Complex data management
- [Shopping Cart](./shopping-cart) - E-commerce patterns
- [Snapshots Guide](../snapshots) - Advanced snapshot usage

## Related Guides

- [History & Time-Travel](../history) - Implement save states
- [Performance](../performance) - Optimize game loops
- [Best Practices](../best-practices) - Game state patterns
