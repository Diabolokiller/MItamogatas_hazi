// tests/upgrade.test.js
// Acceptance Criteria #8: Normal Operation - Machine Upgrade

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FactorySimulation } from '../src/simulation.js';
import { DIRECTIONS, getUpgradeCost, getAdjustedCycleTime, BUILDINGS } from '../src/config.js';

describe('Elfogadási feltétel #8: Gép fejlesztése (Upgrade)', () => {
  test('A gép fejlesztése levonja a költséget, növeli a szintet és csökkenti a ciklusidőt', () => {
    const sim = new FactorySimulation({ balance: 500 });

    // 1. Build Miner at (0, 0) for $100 -> balance = 400
    sim.build(0, 0, 'miner', DIRECTIONS.RIGHT, { resource: 'iron_ore' });
    assert.equal(sim.balance, 400);

    const miner = sim.getBuilding(0, 0);
    assert.equal(miner.level, 1);

    // Calculate upgrade cost for Level 1 -> 2
    const expectedUpgradeCost = getUpgradeCost('miner', 1); // floor(100 * 1.8^1) = 180
    assert.equal(expectedUpgradeCost, 180);

    // 2. Perform upgrade
    const result = sim.upgrade(0, 0);
    assert.equal(result.success, true);
    assert.equal(result.level, 2);
    assert.equal(result.cost, 180);

    // Balance must be 400 - 180 = 220
    assert.equal(sim.balance, 220);
    assert.equal(miner.level, 2);

    // Speed check:
    // Level 1 cycle time: 2.0s
    // Level 2 cycle time: 2.0 / 1.5 = 1.333s
    const level1Time = getAdjustedCycleTime(BUILDINGS.miner.baseCycleTime, 1);
    const level2Time = getAdjustedCycleTime(BUILDINGS.miner.baseCycleTime, 2);
    assert.equal(level1Time, 2.0);
    assert.ok(Math.abs(level2Time - 1.3333) < 0.001);

    // Simulate 1.4 seconds: Level 2 miner completes cycle and produces item
    for (let i = 0; i < 14; i++) {
      sim.tick(0.1);
    }

    assert.ok(miner.outputSlot !== null, 'A 2-es szintű gép 1.4s alatt már elkészítette az elemet');
    assert.equal(miner.outputSlot.itemId, 'iron_ore');
  });

  test('Ha nincs elég pénz a fejlesztésre, a fejlesztés meghiúsul, az egyenleg és a szint változatlan marad', () => {
    const sim = new FactorySimulation({ balance: 110 });

    // Build Miner for $100 -> balance = 10
    sim.build(0, 0, 'miner', DIRECTIONS.RIGHT);
    assert.equal(sim.balance, 10);

    // Upgrade cost is $180, but balance is only $10
    const result = sim.upgrade(0, 0);

    assert.equal(result.success, false);
    assert.equal(result.code, 'INSUFFICIENT_FUNDS');
    assert.ok(result.error.includes('Nincs elég fedezet'));

    // Building level and balance unchanged
    const miner = sim.getBuilding(0, 0);
    assert.equal(miner.level, 1);
    assert.equal(sim.balance, 10);
  });
});
