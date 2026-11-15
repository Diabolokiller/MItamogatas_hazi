// src/auth.js - Authentication and cryptography service

import { pbkdf2Sync, randomBytes } from 'node:crypto';

export function hashPassword(password, salt = null) {
  if (!salt) {
    salt = randomBytes(16).toString('hex');
  }
  const hash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, storedHash, salt) {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

export function generateToken() {
  return randomBytes(32).toString('hex');
}
