// tests/offline-profit.test.js
// Acceptance Criteria #5: Edge Case - Offline Profit Limit (24h Cap)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOfflineProfit } from '../src/simulation.js';
import { Database } from '../src/db.js';
import { createRouter } from '../src/routes.js';
import { hashPassword } from '../src/auth.js';

describe('Elfogadási feltétel #5: Határeset (Offline profit és 24 órás limit)', () => {
  const PROFIT_RATE = 10.0; // $10 / sec

  test('Normál offline időszak (pl. 5 óra): helyesen számolja a profitot (80% hatásfokkal)', () => {
    const lastSaved = 1000000;
    const now = lastSaved + 5 * 3600 * 1000; // 5 hours later

    const res = calculateOfflineProfit(lastSaved, now, PROFIT_RATE);

    assert.equal(res.rawElapsedSeconds, 18000);
    assert.equal(res.elapsedSeconds, 18000);
    assert.equal(res.capped, false);
    // 18000s * 10 $/s * 0.8 = 144,000
    assert.equal(res.profit, 144000);
  });

  test('24 óránál hosszabb offline időszak (pl. 30 óra): a rendszer szigorúan 24 óránál (86400s) maximalizálja a jóváírást', () => {
    const lastSaved = 1000000;
    const now = lastSaved + 30 * 3600 * 1000; // 30 hours later (108000s)

    const res = calculateOfflineProfit(lastSaved, now, PROFIT_RATE);

    assert.equal(res.rawElapsedSeconds, 108000);
    assert.equal(res.elapsedSeconds, 86400, 'Az eltelt idő nem haladhatja meg a 24 órát (86400 másodpercet)');
    assert.equal(res.capped, true);
    // 86400s * 10 $/s * 0.8 = 691,200
    assert.equal(res.profit, 691200);

    // Verify that the extra 6 hours yielded NO profit
    const res24h = calculateOfflineProfit(lastSaved, lastSaved + 24 * 3600 * 1000, PROFIT_RATE);
    assert.equal(res.profit, res24h.profit, 'A 30 órás profitnak pontosan meg kell egyeznie a 24 órás profittal');
  });

  test('Negatív vagy azonnali időbélyeg nem adhat negatív vagy érvénytelen profitot', () => {
    const now = 5000000;
    // Current time earlier than lastSaved (clock rollback attempt)
    const resNegative = calculateOfflineProfit(now + 10000, now, PROFIT_RATE);
    assert.equal(resNegative.profit, 0);
    assert.equal(resNegative.elapsedSeconds, 0);

    // Zero profit rate
    const resZeroRate = calculateOfflineProfit(now - 10000, now, 0);
    assert.equal(resZeroRate.profit, 0);
  });

  test('API integráció: A backend jóváírja az offline profitot, és azonnali ismételt kérésre nem ad duplán', async () => {
    const db = new Database(':memory:');
    const router = createRouter(db);

    const { hash, salt } = hashPassword('pass123');
    const user = db.createUser('offline_player', hash, salt);
    const token = 'test-token-offline';
    db.createSession(token, user.id);

    // Set user last_saved to 2 hours ago with profit rate 5 $/s
    const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
    db.updateFactoryState(user.id, 500, 5.0, [], twoHoursAgo);

    // 1. Claim offline profit
    let claimResponse = null;
    let resMock = {
      statusCode: null,
      writeHead: (code) => { resMock.statusCode = code; },
      end: (data) => { claimResponse = JSON.parse(data); }
    };

    await router.handleRequest(
      {
        url: '/api/factory/claim-offline',
        method: 'POST',
        headers: { authorization: `Bearer ${token}` }
      },
      resMock,
      null
    );

    assert.equal(resMock.statusCode, 200);
    assert.equal(claimResponse.success, true);
    // 7200s * 5 $/s * 0.8 = 28,800
    assert.ok(claimResponse.claimedAmount >= 28700 && claimResponse.claimedAmount <= 28900);
    assert.equal(claimResponse.newBalance, 500 + claimResponse.claimedAmount);

    // 2. Immediately attempt to claim again
    let claim2Response = null;
    let resMock2 = {
      statusCode: null,
      writeHead: (code) => { resMock2.statusCode = code; },
      end: (data) => { claim2Response = JSON.parse(data); }
    };

    await router.handleRequest(
      {
        url: '/api/factory/claim-offline',
        method: 'POST',
        headers: { authorization: `Bearer ${token}` }
      },
      resMock2,
      null
    );

    assert.equal(resMock2.statusCode, 200);
    assert.equal(claim2Response.success, false, 'Nem lehet azonnal újra jóváírni az offline profitot');

    db.close();
  });
});
