// tests/backpressure.test.js
// Acceptance Criteria #4: Edge Case - Congestion / Backpressure

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FactorySimulation } from '../src/simulation.js';
import { DIRECTIONS, CRAFTER_BUFFER_LIMIT } from '../src/config.js';

describe('Elfogadási feltétel #4: Határeset (Torlódás és backpressure)', () => {
  test('A szalag végén torlódó elem megállítja az előtte lévő bányászt; nincs elemvesztés', () => {
    const sim = new FactorySimulation({ balance: 1000 });

    // Miner at (0, 0) facing right -> Conveyor at (1, 0) facing right -> (2, 0) is EMPTY
    sim.build(0, 0, 'miner', DIRECTIONS.RIGHT, { resource: 'iron_ore' });
    sim.build(1, 0, 'conveyor', DIRECTIONS.RIGHT);

    const miner = sim.getBuilding(0, 0);
    const conveyor = sim.getBuilding(1, 0);

    // Run 3.0 seconds (miner produces in 2.0s, conveyor takes 0.8s)
    for (let i = 0; i < 30; i++) {
      sim.tick(0.1);
    }

    // 1st item should be on conveyor, stuck at progress 1.0 because (2, 0) is empty
    assert.ok(conveyor.item !== null, 'A szalagon lévő elem nem veszett el');
    assert.equal(conveyor.item.progress, 1.0, 'Az elem a szalag végén vár');

    // Run another 2.5 seconds. Miner finishes producing 2nd item and attempts to push,
    // but conveyor is blocked. Therefore 2nd item is held in miner.outputSlot.
    for (let i = 0; i < 25; i++) {
      sim.tick(0.1);
    }

    assert.ok(miner.outputSlot !== null, 'A bányász kimeneti tárolójában tartja a 2. elemet');
    assert.equal(miner.progress, 0, 'A bányász leállította az újabb termelést a torlódás miatt');

    // Run for another 10 seconds: no 3rd item should ever be created, no crash, no memory leak
    for (let i = 0; i < 100; i++) {
      sim.tick(0.1);
    }

    assert.ok(conveyor.item !== null, 'Szalag továbbra is tartja az 1. elemet');
    assert.ok(miner.outputSlot !== null, 'Bányász továbbra is tartja a 2. elemet');

    // Now resolve congestion: build Seller at (2, 0)
    sim.build(2, 0, 'seller');
    const balanceBeforeFlush = sim.balance;

    // Tick forward 2.0s to allow both congested items to reach the seller
    for (let i = 0; i < 20; i++) {
      sim.tick(0.1);
    }

    // Both items (item 1 from conveyor and item 2 from miner outputSlot) must be sold: 2 * $10 = +$20
    assert.equal(
      sim.balance,
      balanceBeforeFlush + 20,
      'Mindkét torlódott elem megmaradt és eladásra került!'
    );
    assert.equal(miner.outputSlot, null, 'A bányász kimeneti tárolója felszabadult');
  });

  test('Ha a Crafter bemeneti tárolója megtelik, a bejövő szalag leállítja a továbbítást', () => {
    const sim = new FactorySimulation({ balance: 1000 });

    // Conveyor at (0, 0) facing right -> Crafter at (1, 0)
    sim.build(0, 0, 'conveyor', DIRECTIONS.RIGHT);
    sim.build(1, 0, 'crafter', DIRECTIONS.DOWN, { recipeId: 'iron_gear' });

    const conveyor = sim.getBuilding(0, 0);
    const crafter = sim.getBuilding(1, 0);

    // Crafter is already actively crafting and its input buffer is filled to max capacity (4)
    crafter.isCrafting = true;
    crafter.craftProgress = 0.1;
    crafter.inputBuffer['iron_ore'] = CRAFTER_BUFFER_LIMIT;

    // Place an iron_ore on the conveyor
    conveyor.item = { itemId: 'iron_ore', id: 'ore_overflow', progress: 0.95 };

    // Tick forward: conveyor reaches 1.0 and tries to push to crafter
    sim.tick(0.1);

    // Since crafter buffer is at max capacity, conveyor item must NOT enter crafter and must NOT be lost
    assert.ok(conveyor.item !== null, 'Az elem nem veszett el és nem került be a tele tárolóba');
    assert.equal(conveyor.item.itemId, 'iron_ore');
    assert.equal(crafter.inputBuffer['iron_ore'], CRAFTER_BUFFER_LIMIT);
  });
});
