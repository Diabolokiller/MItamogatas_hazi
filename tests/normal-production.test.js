// tests/normal-production.test.js
// Acceptance Criteria #1 and #2: Normal Production and Combining (Crafting)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FactorySimulation } from '../src/simulation.js';
import { DIRECTIONS } from '../src/config.js';

describe('Elfogadási feltétel #1: Normál termelés (Miner -> Conveyor -> Seller)', () => {
  test('A bányász által termelt nyersanyag eléri az eladót a szalagon és növeli az egyenleget', () => {
    const sim = new FactorySimulation({ balance: 500 });

    // Build: Miner(0,0) -> Conveyor(1,0) -> Seller(2,0)
    const b1 = sim.build(0, 0, 'miner', DIRECTIONS.RIGHT, { resource: 'iron_ore' });
    const b2 = sim.build(1, 0, 'conveyor', DIRECTIONS.RIGHT);
    const b3 = sim.build(2, 0, 'seller');

    assert.equal(b1.success, true);
    assert.equal(b2.success, true);
    assert.equal(b3.success, true);

    const initialBalance = sim.balance; // 500 - 100 - 10 - 150 = 240
    assert.equal(initialBalance, 240);

    // Miner cycle time is 2.0s, conveyor speed is 0.8s
    // Simulate 3.5 seconds in 0.1s increments
    for (let i = 0; i < 35; i++) {
      sim.tick(0.1);
    }

    // After 3.5s, at least 1 iron ore ($10) should have reached the seller
    assert.ok(
      sim.balance > initialBalance,
      `Az egyenlegnek nőnie kellett volna. Kezdeti: ${initialBalance}, Jelenlegi: ${sim.balance}`
    );
    assert.equal(sim.balance, initialBalance + 10);
  });
});

describe('Elfogadási feltétel #2: Normál kombinálás (Crafter receptkészítés)', () => {
  test('A készítő az alapanyagok beérkezése után elkészíti a recept szerinti terméket', () => {
    const sim = new FactorySimulation({ balance: 1000 });

    // Build Crafter at (1, 0) facing RIGHT with recipe 'iron_gear' (needs 2 iron_ore)
    const crafterBuild = sim.build(1, 0, 'crafter', DIRECTIONS.RIGHT, { recipeId: 'iron_gear' });
    assert.equal(crafterBuild.success, true);

    const crafter = sim.getBuilding(1, 0);
    assert.ok(crafter);

    // Manually feed 1st iron ore into crafter
    sim.pushItem(1, 0, { itemId: 'iron_ore' });
    assert.equal(crafter.inputBuffer['iron_ore'], 1);
    assert.equal(crafter.isCrafting, false);

    // Feed 2nd iron ore into crafter
    sim.pushItem(1, 0, { itemId: 'iron_ore' });
    assert.equal(crafter.inputBuffer['iron_ore'], 2);

    // Next tick should trigger crafting start (consumes 2 iron_ore)
    sim.tick(0.1);
    assert.equal(crafter.isCrafting, true);
    assert.equal(crafter.inputBuffer['iron_ore'], 0);

    // Craft time for iron_gear is 2.5s. Tick 26 times (2.6s)
    for (let i = 0; i < 26; i++) {
      sim.tick(0.1);
    }

    // Crafting should be finished and outputSlot should hold 'iron_gear'
    assert.equal(crafter.isCrafting, false);
    assert.ok(crafter.outputSlot, 'A kimeneti tárolóban meg kell jelennie a készterméknek');
    assert.equal(crafter.outputSlot.itemId, 'iron_gear');
  });
});
