// src/routes.js - API request router

import { hashPassword, verifyPassword, generateToken } from './auth.js';
import { calculateOfflineProfit } from './simulation.js';
import { getUpgradeCost, BUILDINGS } from './config.js';

export function createRouter(db) {
  function getBearerToken(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7).trim();
  }

  function authenticate(req) {
    const token = getBearerToken(req);
    if (!token) return null;
    return db.getUserByToken(token);
  }

  function jsonResponse(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
  }

  async function handleRequest(req, res, body) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    const method = req.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      return res.end();
    }

    // Health check
    if (path === '/api/health' && method === 'GET') {
      return jsonResponse(res, 200, { status: 'ok', serverTime: Date.now() });
    }

    // 1. REGISTER
    if (path === '/api/auth/register' && method === 'POST') {
      const { username, password } = body || {};
      if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return jsonResponse(res, 400, { error: 'A felhasználónévnek legalább 3 karakterből kell állnia.' });
      }
      if (!password || typeof password !== 'string' || password.length < 4) {
        return jsonResponse(res, 400, { error: 'A jelszónak legalább 4 karakterből kell állnia.' });
      }

      const existing = db.getUserByUsername(username.trim());
      if (existing) {
        return jsonResponse(res, 409, { error: 'Ez a felhasználónév már foglalt.' });
      }

      const { hash, salt } = hashPassword(password);
      const user = db.createUser(username.trim(), hash, salt);
      const token = generateToken();
      db.createSession(token, user.id);

      return jsonResponse(res, 201, {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          balance: user.balance,
          profitRate: user.profit_rate
        }
      });
    }

    // 2. LOGIN
    if (path === '/api/auth/login' && method === 'POST') {
      const { username, password } = body || {};
      if (!username || !password) {
        return jsonResponse(res, 400, { error: 'Felhasználónév és jelszó megadása kötelező.' });
      }

      const user = db.getUserByUsername(username.trim());
      if (!user) {
        return jsonResponse(res, 401, { error: 'Helytelen felhasználónév vagy jelszó.' });
      }

      const isValid = verifyPassword(password, user.password_hash, user.salt);
      if (!isValid) {
        return jsonResponse(res, 401, { error: 'Helytelen felhasználónév vagy jelszó.' });
      }

      const token = generateToken();
      db.createSession(token, user.id);

      return jsonResponse(res, 200, {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          balance: user.balance,
          profitRate: user.profit_rate
        }
      });
    }

    // 3. LOGOUT
    if (path === '/api/auth/logout' && method === 'POST') {
      const token = getBearerToken(req);
      if (token) {
        db.deleteSession(token);
      }
      return jsonResponse(res, 200, { success: true });
    }

    // --- Protected Routes ---
    const user = authenticate(req);
    if (!user) {
      return jsonResponse(res, 401, { error: 'Bejelentkezés szükséges (érvénytelen vagy hiányzó token).' });
    }

    // 4. GET FACTORY STATE
    if (path === '/api/factory' && method === 'GET') {
      let grid = [];
      try {
        grid = JSON.parse(user.grid_data || '[]');
      } catch {
        grid = [];
      }

      const now = Date.now();
      const offline = calculateOfflineProfit(user.last_saved, now, user.profit_rate);

      return jsonResponse(res, 200, {
        user: {
          id: user.id,
          username: user.username
        },
        balance: user.balance,
        profitRate: user.profit_rate,
        grid,
        lastSaved: user.last_saved,
        serverTime: now,
        offlineProgress: offline
      });
    }

    // 5. SAVE FACTORY STATE
    if (path === '/api/factory/save' && method === 'POST') {
      const { balance, profitRate, grid } = body || {};
      if (balance === undefined || !Array.isArray(grid)) {
        return jsonResponse(res, 400, { error: 'Érvénytelen mentési adat (balance és grid mezők kötelezők).' });
      }

      const now = Date.now();
      db.updateFactoryState(user.id, balance, profitRate || 0, grid, now);

      return jsonResponse(res, 200, {
        success: true,
        lastSaved: now,
        balance
      });
    }

    // 6. CLAIM OFFLINE PROFIT
    if (path === '/api/factory/claim-offline' && method === 'POST') {
      const now = Date.now();
      const offline = calculateOfflineProfit(user.last_saved, now, user.profit_rate);

      if (offline.profit > 0) {
        const newBalance = user.balance + offline.profit;
        // Update user state with new balance and refresh last_saved to now so it cannot be claimed twice
        db.updateFactoryState(
          user.id,
          newBalance,
          user.profit_rate,
          JSON.parse(user.grid_data || '[]'),
          now
        );

        return jsonResponse(res, 200, {
          success: true,
          claimedAmount: offline.profit,
          elapsedSeconds: offline.elapsedSeconds,
          capped: offline.capped,
          newBalance
        });
      } else {
        return jsonResponse(res, 200, {
          success: false,
          message: 'Nincs elérhető jóváírható offline profit.',
          newBalance: user.balance
        });
      }
    }

    // 7. UPGRADE BUILDING VALIDATION
    if (path === '/api/factory/upgrade' && method === 'POST') {
      const { buildingType, currentLevel } = body || {};
      const cost = getUpgradeCost(buildingType, currentLevel);
      if (cost === null) {
        return jsonResponse(res, 400, { error: 'A gép nem fejleszthető tovább.' });
      }

      if (user.balance < cost) {
        return jsonResponse(res, 400, {
          error: `Nincs elég fedezet! Szükséges: $${cost}, elérhető: $${user.balance}`,
          code: 'INSUFFICIENT_FUNDS'
        });
      }

      const newBalance = user.balance - cost;
      db.updateUserBalance(user.id, newBalance);

      return jsonResponse(res, 200, {
        success: true,
        newLevel: currentLevel + 1,
        cost,
        newBalance
      });
    }

    return jsonResponse(res, 404, { error: 'Nem létező végpont.' });
  }

  return { handleRequest };
}
