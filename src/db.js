// src/db.js - SQLite database layer using Node 22+ built-in node:sqlite

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STARTING_BALANCE } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_DIR = join(__dirname, '..', 'data');
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = join(DB_DIR, 'factory.db');

export class Database {
  constructor(dbPath = DB_PATH) {
    this.db = new DatabaseSync(dbPath);
    this.initTables();
  }

  initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        balance INTEGER NOT NULL DEFAULT ${STARTING_BALANCE},
        profit_rate REAL NOT NULL DEFAULT 0.0,
        grid_data TEXT NOT NULL DEFAULT '[]',
        last_saved INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
    `);
  }

  // --- User operations ---

  createUser(username, passwordHash, salt) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO users (username, password_hash, salt, balance, profit_rate, grid_data, last_saved, created_at)
      VALUES (?, ?, ?, ?, 0.0, '[]', ?, ?)
    `);
    const result = stmt.run(username, passwordHash, salt, STARTING_BALANCE, now, now);
    return {
      id: Number(result.lastInsertRowid),
      username,
      balance: STARTING_BALANCE,
      profit_rate: 0.0,
      grid_data: '[]',
      last_saved: now
    };
  }

  getUserByUsername(username) {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE username = ?`);
    return stmt.get(username) || null;
  }

  getUserById(id) {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE id = ?`);
    return stmt.get(id) || null;
  }

  updateFactoryState(userId, balance, profitRate, gridData, lastSaved = Date.now()) {
    const stmt = this.db.prepare(`
      UPDATE users
      SET balance = ?, profit_rate = ?, grid_data = ?, last_saved = ?
      WHERE id = ?
    `);
    stmt.run(balance, profitRate, JSON.stringify(gridData), lastSaved, userId);
  }

  updateUserBalance(userId, newBalance) {
    const stmt = this.db.prepare(`UPDATE users SET balance = ? WHERE id = ?`);
    stmt.run(newBalance, userId);
  }

  // --- Session operations ---

  createSession(token, userId, durationMs = 7 * 24 * 3600 * 1000) {
    const now = Date.now();
    const expiresAt = now + durationMs;
    const stmt = this.db.prepare(`
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(token, userId, now, expiresAt);
    return { token, userId, expiresAt };
  }

  getUserByToken(token) {
    if (!token) return null;
    const now = Date.now();
    const stmt = this.db.prepare(`
      SELECT u.id, u.username, u.balance, u.profit_rate, u.grid_data, u.last_saved
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
    `);
    return stmt.get(token, now) || null;
  }

  deleteSession(token) {
    const stmt = this.db.prepare(`DELETE FROM sessions WHERE token = ?`);
    stmt.run(token);
  }

  close() {
    this.db.close();
  }
}

export const defaultDb = new Database();
