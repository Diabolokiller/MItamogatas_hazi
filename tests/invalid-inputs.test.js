// tests/invalid-inputs.test.js
// Acceptance Criteria #6 & #7: Invalid Inputs (Insufficient Funds, Collision) & Unauthorized operations

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FactorySimulation } from '../src/simulation.js';
import { Database } from '../src/db.js';
import { createRouter } from '../src/routes.js';
import { DIRECTIONS } from '../src/config.js';

describe('Elfogadási feltétel #6: Hibás bemenet (Fedezet hiánya)', () => {
  test('Ha a játékos egyenlege kisebb a gép áránál, a gép nem kerül le és az egyenleg nem csökken', () => {
    // Starting with only $50 balance
    const sim = new FactorySimulation({ balance: 50 });

    // Miner costs $100
    const result = sim.build(0, 0, 'miner', DIRECTIONS.RIGHT);

    assert.equal(result.success, false);
    assert.equal(result.code, 'INSUFFICIENT_FUNDS');
    assert.ok(result.error.includes('Nincs elég fedezet'));

    // Grid cell remains null
    assert.equal(sim.getBuilding(0, 0), null);

    // Balance remains exactly $50
    assert.equal(sim.balance, 50);
  });
});

describe('Elfogadási feltétel #7: Hibás bemenet (Ütközés - Foglalt mezőre építés)', () => {
  test('Foglalt mezőre történő építés meghiúsul, a meglévő gép sértetlen marad, az egyenleg nem változik', () => {
    const sim = new FactorySimulation({ balance: 500 });

    // 1. Build conveyor at (3, 3) for $10 -> balance = 490
    const b1 = sim.build(3, 3, 'conveyor', DIRECTIONS.UP);
    assert.equal(b1.success, true);
    assert.equal(sim.balance, 490);

    // 2. Attempt to build a Miner ($100) on the exact same tile (3, 3)
    const b2 = sim.build(3, 3, 'miner', DIRECTIONS.RIGHT);

    assert.equal(b2.success, false);
    assert.equal(b2.code, 'COLLISION');
    assert.ok(b2.error.includes('A mező már foglalt'));

    // Original conveyor must still be there intact
    const currentBuilding = sim.getBuilding(3, 3);
    assert.ok(currentBuilding);
    assert.equal(currentBuilding.type, 'conveyor');
    assert.equal(currentBuilding.direction, DIRECTIONS.UP);

    // Balance must NOT have decreased
    assert.equal(sim.balance, 490);
  });
});

describe('Jogosulatlan művelet ellenőrzése (Unauthorized API Access)', () => {
  test('Érvénytelen vagy hiányzó token esetén a védett API végpontok 401-es hibát adnak', async () => {
    const db = new Database(':memory:');
    const router = createRouter(db);

    let resData = null;
    let resMock = {
      statusCode: null,
      writeHead: (code) => { resMock.statusCode = code; },
      end: (data) => { resData = JSON.parse(data); }
    };

    // Requesting /api/factory without auth token
    await router.handleRequest(
      { url: '/api/factory', method: 'GET', headers: {} },
      resMock,
      null
    );

    assert.equal(resMock.statusCode, 401);
    assert.ok(resData.error.includes('Bejelentkezés szükséges'));

    // Requesting save with invalid forged token
    let resData2 = null;
    let resMock2 = {
      statusCode: null,
      writeHead: (code) => { resMock2.statusCode = code; },
      end: (data) => { resData2 = JSON.parse(data); }
    };

    await router.handleRequest(
      {
        url: '/api/factory/save',
        method: 'POST',
        headers: { authorization: 'Bearer fake_invalid_token_999' }
      },
      resMock2,
      { balance: 99999, grid: [] }
    );

    assert.equal(resMock2.statusCode, 401);

    db.close();
  });
});
