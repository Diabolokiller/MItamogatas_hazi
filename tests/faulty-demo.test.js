// tests/faulty-demo.test.js
// Demonstration of Faulty vs Fixed Implementation (PDF requirement: Tesztelés és hibafeltárás 5 pont)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOfflineProfit as fixedCalculateOfflineProfit } from '../src/simulation.js';

/**
 * HIBÁS VÁLTOZAT (Naive / Faulty implementation):
 * 1. Nem korlátozza az offline eltelt időt a specifikációban előírt 24 órára (86400 másodperc).
 * 2. Óra-visszaállítás / negatív eltelt idő esetén nem védi ki a negatív értékeket.
 */
function faultyCalculateOfflineProfit(lastSaved, now, profitRate) {
  // Hiba: Nincs felső korlát (cap), nincs negatív idő vizsgálat!
  const elapsedSeconds = (now - lastSaved) / 1000;
  // Hiba: nincsen lebegőpontos kerekítés (Math.floor) sem
  const profit = elapsedSeconds * profitRate * 0.8;
  return {
    elapsedSeconds,
    profit,
    capped: false // mindig hamis, mert nincs korlát!
  };
}

describe('Hibás vs. Javított változat összehasonlítása (Faulty vs Fixed Demonstration)', () => {
  const PROFIT_RATE = 10.0; // $10 / sec
  const lastSaved = 1000000;
  const thirtyHoursLater = lastSaved + 30 * 3600 * 1000; // 30 hours later (108,000s)

  test('1. A HIBÁS változat ELBUKIK a 24 órás felső korlát (86400s) tesztjén', () => {
    const result = faultyCalculateOfflineProfit(lastSaved, thirtyHoursLater, PROFIT_RATE);

    console.log('\n--- HIBÁS VÁLTOZAT FUTÁSI EREDMÉNYE ---');
    console.log(`Eltelt idő: ${result.elapsedSeconds}s (Elvárt max: 86400s)`);
    console.log(`Számolt profit: $${result.profit} (Elvárt max: $691200)`);
    console.log(`Capped jelző: ${result.capped} (Elvárt: true)`);

    // Ellenőrizzük, hogy a hibás függvény valóban elbukik a specifikáció elfogadási feltételén:
    let failedAsExpected = false;
    try {
      // Ez az assert el fog bukni a hibás változatnál:
      assert.equal(
        result.elapsedSeconds,
        86400,
        'HIBA: A hibás kód 108000 másodpercet számolt 86400 helyett!'
      );
      assert.equal(result.capped, true);
    } catch (err) {
      failedAsExpected = true;
      console.log(`✔ A hibás változat a várakozásnak megfelelően elbukott: "${err.message}"`);
    }

    assert.equal(
      failedAsExpected,
      true,
      'A hibás változatnak el kellett buknia a 24 órás limit ellenőrzésen!'
    );
  });

  test('2. A JAVÍTOTT változat SIKERESEN ÁTMEGY a teszten a 24 órás limittel', () => {
    const result = fixedCalculateOfflineProfit(lastSaved, thirtyHoursLater, PROFIT_RATE);

    console.log('\n--- JAVÍTOTT VÁLTOZAT FUTÁSI EREDMÉNYE ---');
    console.log(`Eltelt idő: ${result.elapsedSeconds}s (Elvárt max: 86400s)`);
    console.log(`Számolt profit: $${result.profit} (Elvárt: $691200)`);
    console.log(`Capped jelző: ${result.capped} (Elvárt: true)`);

    // A javított változat teljesíti az elfogadási feltételt:
    assert.equal(result.elapsedSeconds, 86400);
    assert.equal(result.capped, true);
    assert.equal(result.profit, 691200);
    console.log('✔ A javított változat sikeresen teljesítette az összes elfogadási feltételt!');
  });
});
