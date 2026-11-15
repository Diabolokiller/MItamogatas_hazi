// tests/persistence.test.js
// Acceptance Criteria #3: Persistence (Database, State Save & Load)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from '../src/db.js';
import { createRouter } from '../src/routes.js';
import { hashPassword, verifyPassword } from '../src/auth.js';

describe('Elfogadási feltétel #3: Perzisztencia (Állapotmentés és betöltés)', () => {
  test('Felhasználói regisztráció és jelszóhashelés helyesen működik', () => {
    const db = new Database(':memory:');
    const { hash, salt } = hashPassword('titkosJelszo123');

    assert.ok(hash && hash.length > 32);
    assert.ok(salt && salt.length > 10);
    assert.equal(verifyPassword('titkosJelszo123', hash, salt), true);
    assert.equal(verifyPassword('hibasJelszo', hash, salt), false);

    const user = db.createUser('teszt_jatekos', hash, salt);
    assert.equal(user.username, 'teszt_jatekos');
    assert.equal(user.balance, 500);

    db.close();
  });

  test('A gyárelrendezés és egyenleg sikeresen mentődik és betöltődik bejelentkezés után', async () => {
    const db = new Database(':memory:');
    const router = createRouter(db);

    // 1. Register a user via router
    let regResponse = null;
    let resMock = {
      writeHead: (code, headers) => { resMock.statusCode = code; },
      end: (data) => { regResponse = JSON.parse(data); }
    };

    await router.handleRequest(
      { url: '/api/auth/register', method: 'POST', headers: {} },
      resMock,
      { username: 'bence_factory', password: 'securePassword99' }
    );

    assert.equal(resMock.statusCode, 201);
    assert.ok(regResponse.token);
    const token = regResponse.token;

    // 2. Save custom factory layout and balance
    const sampleGrid = [
      [{ type: 'miner', direction: 'right', level: 2, resource: 'iron_ore' }],
      [{ type: 'seller', level: 1 }]
    ];
    const newBalance = 1450;
    const profitRate = 12.5;

    let saveResponse = null;
    let saveResMock = {
      statusCode: null,
      writeHead: (code) => { saveResMock.statusCode = code; },
      end: (data) => { saveResponse = JSON.parse(data); }
    };

    await router.handleRequest(
      {
        url: '/api/factory/save',
        method: 'POST',
        headers: { authorization: `Bearer ${token}` }
      },
      saveResMock,
      { balance: newBalance, profitRate, grid: sampleGrid }
    );

    assert.equal(saveResMock.statusCode, 200);
    assert.equal(saveResponse.success, true);
    assert.equal(saveResponse.balance, 1450);

    // 3. Load factory state via GET /api/factory
    let getResponse = null;
    let getResMock = {
      writeHead: (code) => { getResMock.statusCode = code; },
      end: (data) => { getResponse = JSON.parse(data); }
    };

    await router.handleRequest(
      {
        url: '/api/factory',
        method: 'GET',
        headers: { authorization: `Bearer ${token}` }
      },
      getResMock,
      null
    );

    assert.equal(getResMock.statusCode, 200);
    assert.equal(getResponse.balance, 1450);
    assert.equal(getResponse.profitRate, 12.5);
    assert.equal(getResponse.grid[0][0].type, 'miner');
    assert.equal(getResponse.grid[0][0].level, 2);
    assert.equal(getResponse.grid[1][0].type, 'seller');

    db.close();
  });
});
