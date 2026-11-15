// src/simulation.js - Deterministic factory simulation logic

import {
  GRID_WIDTH,
  GRID_HEIGHT,
  STARTING_BALANCE,
  DIRECTIONS,
  DIRECTION_OFFSETS,
  ITEMS,
  RECIPES,
  BUILDINGS,
  DEMOLISH_REFUND_RATIO,
  MAX_OFFLINE_SECONDS,
  OFFLINE_EFFICIENCY,
  CRAFTER_BUFFER_LIMIT,
  getUpgradeCost,
  getAdjustedCycleTime
} from './config.js';

let nextItemId = 1;
export function generateItemId() {
  return `item_${Date.now()}_${nextItemId++}`;
}

export class FactorySimulation {
  constructor(options = {}) {
    this.width = options.width || GRID_WIDTH;
    this.height = options.height || GRID_HEIGHT;
    this.balance = options.balance !== undefined ? options.balance : STARTING_BALANCE;
    this.totalEarned = options.totalEarned || 0;
    this.profitRate = options.profitRate || 0; // $/sec
    
    // Sales tracking for profit rate (sliding window over last 10 seconds)
    this.recentSales = [];
    
    // Initialize grid
    this.grid = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push(null);
      }
      this.grid.push(row);
    }

    if (options.grid) {
      this.loadGrid(options.grid);
    }
  }

  isInBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getBuilding(x, y) {
    if (!this.isInBounds(x, y)) return null;
    return this.grid[y][x];
  }

  /**
   * Places a building at (x, y)
   * Validates bounds, collisions, and available balance
   */
  build(x, y, type, direction = DIRECTIONS.RIGHT, extra = {}) {
    if (!this.isInBounds(x, y)) {
      return { success: false, error: 'A koordináta a játéktéren kívül van.', code: 'OUT_OF_BOUNDS' };
    }

    if (this.grid[y][x] !== null) {
      return {
        success: false,
        error: 'A mező már foglalt! Bontsd le a meglévő gépet először.',
        code: 'COLLISION'
      };
    }

    const buildingMeta = BUILDINGS[type];
    if (!buildingMeta) {
      return { success: false, error: `Ismeretlen épülettípus: ${type}`, code: 'INVALID_TYPE' };
    }

    if (this.balance < buildingMeta.baseCost) {
      return {
        success: false,
        error: `Nincs elég fedezet! Szükséges: $${buildingMeta.baseCost}, elérhető: $${this.balance}`,
        code: 'INSUFFICIENT_FUNDS'
      };
    }

    // Deduct cost
    this.balance -= buildingMeta.baseCost;

    const building = {
      type,
      direction: direction || DIRECTIONS.RIGHT,
      level: 1,
      x,
      y
    };

    if (type === 'miner') {
      building.resource = extra.resource || 'iron_ore';
      building.progress = 0;
      building.outputSlot = null; // Holds produced item until pushed
    } else if (type === 'conveyor') {
      building.item = null; // { itemId, id, progress }
    } else if (type === 'crafter') {
      building.recipeId = extra.recipeId || 'iron_gear';
      building.inputBuffer = {};
      building.outputSlot = null;
      building.isCrafting = false;
      building.craftProgress = 0;
    } else if (type === 'seller') {
      building.totalSales = 0;
    }

    this.grid[y][x] = building;
    return { success: true, building, balance: this.balance };
  }

  /**
   * Demolishes building at (x, y) and refunds portion of cost
   */
  demolish(x, y) {
    if (!this.isInBounds(x, y)) {
      return { success: false, error: 'Érvénytelen mező.', code: 'OUT_OF_BOUNDS' };
    }
    const building = this.grid[y][x];
    if (!building) {
      return { success: false, error: 'A mező üres.', code: 'EMPTY_CELL' };
    }

    const baseCost = BUILDINGS[building.type].baseCost;
    const refund = Math.floor(baseCost * DEMOLISH_REFUND_RATIO);
    this.balance += refund;
    this.grid[y][x] = null;

    return { success: true, refund, balance: this.balance };
  }

  /**
   * Upgrades building at (x, y)
   */
  upgrade(x, y) {
    if (!this.isInBounds(x, y)) {
      return { success: false, error: 'Érvénytelen koordináta.', code: 'OUT_OF_BOUNDS' };
    }
    const building = this.grid[y][x];
    if (!building) {
      return { success: false, error: 'Nincs gép a kiválasztott mezőn.', code: 'EMPTY_CELL' };
    }

    const meta = BUILDINGS[building.type];
    if (building.level >= meta.maxLevel) {
      return { success: false, error: 'A gép már elérte a maximális szintet.', code: 'MAX_LEVEL' };
    }

    const cost = getUpgradeCost(building.type, building.level);
    if (this.balance < cost) {
      return {
        success: false,
        error: `Nincs elég fedezet a fejlesztéshez! Szükséges: $${cost}, elérhető: $${this.balance}`,
        code: 'INSUFFICIENT_FUNDS'
      };
    }

    this.balance -= cost;
    building.level += 1;

    return {
      success: true,
      building,
      level: building.level,
      cost,
      balance: this.balance
    };
  }

  /**
   * Checks if target cell can accept an item
   */
  canAcceptItem(targetX, targetY, itemId) {
    if (!this.isInBounds(targetX, targetY)) return false;
    const target = this.grid[targetY][targetX];
    if (!target) return false;

    if (target.type === 'conveyor') {
      return target.item === null;
    }

    if (target.type === 'crafter') {
      const recipe = RECIPES[target.recipeId];
      if (!recipe) return false;
      const requiredQty = recipe.inputs[itemId];
      if (!requiredQty) return false; // Not an ingredient
      const currentQty = target.inputBuffer[itemId] || 0;
      return currentQty < CRAFTER_BUFFER_LIMIT;
    }

    if (target.type === 'seller') {
      return true; // Seller always accepts and liquidates
    }

    return false; // Miners cannot accept items
  }

  /**
   * Pushes item into target cell
   */
  pushItem(targetX, targetY, item) {
    if (!this.isInBounds(targetX, targetY)) return false;
    const target = this.grid[targetY][targetX];
    if (!target) return false;

    if (target.type === 'conveyor') {
      if (target.item !== null) return false;
      target.item = {
        itemId: item.itemId,
        id: item.id || generateItemId(),
        progress: 0,
        movedThisTick: true
      };
      return true;
    }

    if (target.type === 'crafter') {
      const recipe = RECIPES[target.recipeId];
      if (!recipe || !recipe.inputs[item.itemId]) return false;
      const currentQty = target.inputBuffer[item.itemId] || 0;
      if (currentQty >= CRAFTER_BUFFER_LIMIT) return false;

      target.inputBuffer[item.itemId] = currentQty + 1;
      return true;
    }

    if (target.type === 'seller') {
      const itemDef = ITEMS[item.itemId];
      if (!itemDef) return false;
      const sellerLevel = target.level || 1;
      const bonusMultiplier = 1 + (sellerLevel - 1) * 0.1;
      const value = Math.floor(itemDef.value * bonusMultiplier);

      this.balance += value;
      this.totalEarned += value;
      target.totalSales = (target.totalSales || 0) + value;

      // Track sale for rolling profit rate
      this.recentSales.push({ timestamp: Date.now(), amount: value });
      return true;
    }

    return false;
  }

  /**
   * Runs one simulation tick (dt seconds)
   */
  tick(dt = 0.1) {
    const now = Date.now();

    // 1. Clear tick movement flags on conveyors
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const b = this.grid[y][x];
        if (b && b.type === 'conveyor' && b.item) {
          b.item.movedThisTick = false;
        }
      }
    }

    // 2. Process Crafters output and crafting progress
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const b = this.grid[y][x];
        if (!b || b.type !== 'crafter') continue;

        const offset = DIRECTION_OFFSETS[b.direction];
        const targetX = x + offset.dx;
        const targetY = y + offset.dy;

        // Try pushing existing output first
        if (b.outputSlot) {
          if (this.canAcceptItem(targetX, targetY, b.outputSlot.itemId)) {
            if (this.pushItem(targetX, targetY, b.outputSlot)) {
              b.outputSlot = null;
            }
          }
          // If still has outputSlot, it is backed up; do not advance or start craft
        }

        const recipe = RECIPES[b.recipeId];
        if (!recipe) continue;

        if (b.isCrafting) {
          const cycleTime = getAdjustedCycleTime(recipe.baseCraftTime, b.level);
          b.craftProgress += dt / cycleTime;
          if (b.craftProgress >= 1.0) {
            b.outputSlot = { itemId: recipe.output, id: generateItemId() };
            b.isCrafting = false;
            b.craftProgress = 0;

            // Attempt to immediately push output
            if (this.canAcceptItem(targetX, targetY, b.outputSlot.itemId)) {
              if (this.pushItem(targetX, targetY, b.outputSlot)) {
                b.outputSlot = null;
              }
            }
          }
        } else if (!b.outputSlot) {
          // Check if we can start crafting
          let canCraft = true;
          for (const [ingredient, qty] of Object.entries(recipe.inputs)) {
            if ((b.inputBuffer[ingredient] || 0) < qty) {
              canCraft = false;
              break;
            }
          }

          if (canCraft) {
            // Deduct ingredients
            for (const [ingredient, qty] of Object.entries(recipe.inputs)) {
              b.inputBuffer[ingredient] -= qty;
            }
            b.isCrafting = true;
            b.craftProgress = 0;
          }
        }
      }
    }

    // 3. Process Conveyor belts (pushing to neighbors when reaching end)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const b = this.grid[y][x];
        if (!b || b.type !== 'conveyor' || !b.item || b.item.movedThisTick) continue;

        const offset = DIRECTION_OFFSETS[b.direction];
        const targetX = x + offset.dx;
        const targetY = y + offset.dy;

        if (b.item.progress >= 1.0) {
          // Attempt to move to next tile
          if (this.canAcceptItem(targetX, targetY, b.item.itemId)) {
            if (this.pushItem(targetX, targetY, b.item)) {
              b.item = null;
            }
          }
          // Otherwise item remains at progress 1.0 (backed up / congested)
        } else {
          // Advance progress on this belt
          const moveTime = BUILDINGS.conveyor.baseCycleTime;
          b.item.progress = Math.min(1.0, b.item.progress + dt / moveTime);

          // If reached 1.0 during this step, attempt to push immediately
          if (b.item.progress >= 1.0) {
            if (this.canAcceptItem(targetX, targetY, b.item.itemId)) {
              if (this.pushItem(targetX, targetY, b.item)) {
                b.item = null;
              }
            }
          }
        }
      }
    }

    // 4. Process Miners
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const b = this.grid[y][x];
        if (!b || b.type !== 'miner') continue;

        const offset = DIRECTION_OFFSETS[b.direction];
        const targetX = x + offset.dx;
        const targetY = y + offset.dy;

        // Try pushing existing outputSlot if holding one
        if (b.outputSlot) {
          if (this.canAcceptItem(targetX, targetY, b.outputSlot.itemId)) {
            if (this.pushItem(targetX, targetY, b.outputSlot)) {
              b.outputSlot = null;
            }
          }
        }

        // If outputSlot is clear, advance production
        if (!b.outputSlot) {
          const cycleTime = getAdjustedCycleTime(BUILDINGS.miner.baseCycleTime, b.level);
          b.progress += dt / cycleTime;
          if (b.progress >= 1.0) {
            b.outputSlot = { itemId: b.resource, id: generateItemId() };
            b.progress = 0;

            // Attempt to immediately push into neighbor
            if (this.canAcceptItem(targetX, targetY, b.outputSlot.itemId)) {
              if (this.pushItem(targetX, targetY, b.outputSlot)) {
                b.outputSlot = null;
              }
            }
          }
        }
      }
    }

    // 5. Update profit rate (10-second sliding window)
    const windowStart = now - 10000;
    this.recentSales = this.recentSales.filter(s => s.timestamp >= windowStart);
    const windowSum = this.recentSales.reduce((acc, s) => acc + s.amount, 0);
    this.profitRate = parseFloat((windowSum / 10).toFixed(2));
  }

  /**
   * Serializes grid and state for saving
   */
  serialize() {
    return {
      balance: this.balance,
      totalEarned: this.totalEarned,
      profitRate: this.profitRate,
      grid: this.grid.map(row =>
        row.map(cell => (cell ? { ...cell } : null))
      )
    };
  }

  /**
   * Loads serialized grid
   */
  loadGrid(savedGrid) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (savedGrid && savedGrid[y] && savedGrid[y][x]) {
          this.grid[y][x] = { ...savedGrid[y][x] };
        } else {
          this.grid[y][x] = null;
        }
      }
    }
  }
}

/**
 * Calculates offline progress and profit.
 * Clamps elapsed time to MAX_OFFLINE_SECONDS (24 hours).
 */
export function calculateOfflineProfit(lastSavedTimestamp, currentTimestamp, profitRate) {
  if (!lastSavedTimestamp || currentTimestamp <= lastSavedTimestamp || !profitRate || profitRate <= 0) {
    return {
      elapsedSeconds: 0,
      rawElapsedSeconds: 0,
      profit: 0,
      capped: false
    };
  }

  const rawElapsedSeconds = Math.max(0, Math.floor((currentTimestamp - lastSavedTimestamp) / 1000));
  const capped = rawElapsedSeconds > MAX_OFFLINE_SECONDS;
  const elapsedSeconds = Math.min(rawElapsedSeconds, MAX_OFFLINE_SECONDS);
  const profit = Math.floor(elapsedSeconds * profitRate * OFFLINE_EFFICIENCY);

  return {
    elapsedSeconds,
    rawElapsedSeconds,
    profit,
    capped
  };
}
