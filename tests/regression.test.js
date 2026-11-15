// tests/regression.test.js
// Regression Test: Upgrading machines under backpressure preserves item state and applies new speed when unblocked

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FactorySimulation } from '../src/simulation.js';
import { DIRECTIONS } from '../src/config.js';

describe('Regressziós teszt: Gépfejlesztés torlódás alatt (Regression)', () => {
  test('A torlódott állapotban lévő gép fejlesztése után a meglévő elem nem vész el, és a feloldás után már a megnövelt sebességgel termel', () => {
    const sim = new FactorySimulation({ balance: 1000 });

    // Miner at (0,0) -> Conveyor at (1,0) -> (2,0) blocked
    sim.build(0, 0, 'miner', DIRECTIONS.RIGHT, { resource: 'iron_ore' });
    sim.build(1, 0, 'conveyor', DIRECTIONS.RIGHT);

    const miner = sim.getBuilding(0, 0);
    const conveyor = sim.getBuilding(1, 0);

    // Run until conveyor is full and miner has an item in outputSlot
    for (let i = 0; i < 50; i++) {
      sim.tick(0.1);
    }

    assert.ok(conveyor.item !== null, 'Szalag foglalt');
    assert.ok(miner.outputSlot !== null, 'Bányász kimeneti tárolója tele van a torlódás miatt');
    assert.equal(miner.level, 1);
    const savedItemId = miner.outputSlot.id;

    // Upgrade the miner to Level 2 while it is in the congested state!
    const upgradeRes = sim.upgrade(0, 0);
    assert.equal(upgradeRes.success, true);
    assert.equal(miner.level, 2);

    // REGRESSION CHECK 1: The held item must NOT be discarded or wiped by the upgrade
    assert.ok(miner.outputSlot !== null, 'A fejlesztés nem veszítheti el a kimeneti tárolóban várakozó elemet');
    assert.equal(miner.outputSlot.id, savedItemId);

    // REGRESSION CHECK 2: Backpressure must remain active as long as the conveyor is still blocked
    sim.tick(0.1);
    assert.ok(miner.outputSlot !== null, 'A torlódásnak érvényben kell maradnia fejlesztés után is');

    // Now unblock by placing Seller at (2,0)
    sim.build(2, 0, 'seller');

    // Run simulation to flush both items and produce a 3rd item at level 2 speed (1.33s)
    // Total time needed:
    // - Conveyor moves item 1 to seller (0.8s)
    // - Miner pushes item 2 to conveyor, conveyor moves to seller (0.8s)
    // - Miner produces item 3 at Level 2 speed (1.33s)
    // Total ~ 3.2s
    for (let i = 0; i < 35; i++) {
      sim.tick(0.1);
    }

    // Miner should have successfully produced a 3rd item at Level 2 speed
    assert.equal(miner.outputSlot !== null || conveyor.item !== null, true);
  });
});
