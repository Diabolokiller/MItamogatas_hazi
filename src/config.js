// src/config.js - Game constants and configuration

export const GRID_WIDTH = 12;
export const GRID_HEIGHT = 12;

export const STARTING_BALANCE = 500;

export const DIRECTIONS = {
  UP: 'up',
  RIGHT: 'right',
  DOWN: 'down',
  LEFT: 'left'
};

export const DIRECTION_OFFSETS = {
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 }
};

export const ITEMS = {
  iron_ore: {
    id: 'iron_ore',
    name: 'Vasérc',
    value: 10,
    color: '#8a9ba8',
    glow: '#a8c0d3'
  },
  copper_ore: {
    id: 'copper_ore',
    name: 'Rézérc',
    value: 12,
    color: '#c87d55',
    glow: '#e09870'
  },
  iron_gear: {
    id: 'iron_gear',
    name: 'Vas fogaskerék',
    value: 30,
    color: '#bdc3c7',
    glow: '#ecf0f1'
  },
  copper_wire: {
    id: 'copper_wire',
    name: 'Rézhuzal',
    value: 32,
    color: '#d35400',
    glow: '#e67e22'
  },
  circuit: {
    id: 'circuit',
    name: 'Áramkör',
    value: 95,
    color: '#27ae60',
    glow: '#2ecc71'
  }
};

export const RECIPES = {
  iron_gear: {
    id: 'iron_gear',
    name: 'Vas fogaskerék',
    inputs: { iron_ore: 2 },
    output: 'iron_gear',
    baseCraftTime: 2.5
  },
  copper_wire: {
    id: 'copper_wire',
    name: 'Rézhuzal',
    inputs: { copper_ore: 2 },
    output: 'copper_wire',
    baseCraftTime: 2.0
  },
  circuit: {
    id: 'circuit',
    name: 'Áramkör',
    inputs: { iron_gear: 1, copper_wire: 1 },
    output: 'circuit',
    baseCraftTime: 4.0
  }
};

export const BUILDINGS = {
  miner: {
    type: 'miner',
    name: 'Bányász',
    baseCost: 100,
    baseCycleTime: 2.0, // seconds
    maxLevel: 5,
    description: 'Nyersanyagot termel és ad ki az előtte lévő mezőre.'
  },
  conveyor: {
    type: 'conveyor',
    name: 'Futószalag',
    baseCost: 10,
    baseCycleTime: 0.8, // seconds per cell movement
    maxLevel: 1,
    description: 'Nyersanyagokat szállít a nyíl irányába.'
  },
  crafter: {
    type: 'crafter',
    name: 'Készítő',
    baseCost: 250,
    baseCycleTime: 2.5,
    maxLevel: 5,
    description: 'Alapanyagokat kombinál receptekké.'
  },
  seller: {
    type: 'seller',
    name: 'Eladó',
    baseCost: 150,
    baseCycleTime: 0.5,
    maxLevel: 5,
    description: 'A beérkező elemeket automatikusan eladja és jóváírja az egyenlegen.'
  }
};

export const DEMOLISH_REFUND_RATIO = 0.7; // 70% refund when demolished

export const MAX_OFFLINE_SECONDS = 24 * 3600; // 24 hours maximum offline profit
export const OFFLINE_EFFICIENCY = 0.8; // 80% efficiency while offline

export const CRAFTER_BUFFER_LIMIT = 4; // Max quantity per ingredient in crafter input buffer
export const CONVEYOR_CAPACITY = 1; // 1 item per conveyor tile

/**
 * Calculates machine upgrade cost based on base cost and current level.
 * Formula: floor(baseCost * 1.8^level)
 */
export function getUpgradeCost(buildingType, currentLevel) {
  const meta = BUILDINGS[buildingType];
  if (!meta || currentLevel >= meta.maxLevel) return null;
  return Math.floor(meta.baseCost * Math.pow(1.8, currentLevel));
}

/**
 * Calculates cycle / craft time multiplier for a given level.
 * Level 1 = 1.0x (baseCycleTime)
 * Level 2 = 1.5x speed (baseCycleTime / 1.5)
 * Level 3 = 2.0x speed
 * Level n = (1 + (n - 1) * 0.5)x speed
 */
export function getSpeedMultiplier(level) {
  return 1 + (level - 1) * 0.5;
}

export function getAdjustedCycleTime(baseTime, level) {
  return baseTime / getSpeedMultiplier(level);
}
