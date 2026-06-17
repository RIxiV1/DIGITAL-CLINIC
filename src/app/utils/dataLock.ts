/**
 * Opt-in at-rest data lock — state + session-key management.
 *
 * When enabled, the user's reports are stored encrypted (see persistence
 * loadReportsMaybeEncrypted / saveReportsMaybeEncrypted) and can only be
 * read after the PIN is entered. This module owns:
 *   - the lock metadata in localStorage (`dc_lock`: salt + a verifier blob)
 *   - the derived AES key for the current session (in memory ONLY)
 *
 * The verifier is a known token sealed with the derived key, so unlock()
 * can check a PIN is correct by trying to decrypt it — without needing
 * the (larger) reports blob, and without ever storing the PIN or key.
 *
 * Crypto lives in crypto.ts; this module is intentionally key-agnostic
 * toward persistence (it never imports it) so there's no import cycle —
 * ReportsContext threads the session key from here into the persistence
 * load/save calls.
 */

import {
  type EncryptedBlob,
  deriveKey,
  encryptString,
  decryptString,
  randomSaltB64,
} from './crypto';

const LOCK_KEY = 'dc_lock';
const VERIFIER_PLAINTEXT = 'formen-data-lock-v1';

type LockMeta = { v: 1; salt: string; verifier: EncryptedBlob };

/** In-memory session key. Set on enable/unlock, dropped on lock(). Never
 *  persisted — losing it on refresh is the point (forces re-entry). */
let sessionKey: CryptoKey | null = null;

function readMeta(): LockMeta | null {
  try {
    const raw = window.localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      p?.v === 1 &&
      typeof p.salt === 'string' &&
      typeof p.verifier?.iv === 'string' &&
      typeof p.verifier?.data === 'string'
    ) {
      return p as LockMeta;
    }
    return null;
  } catch {
    return null;
  }
}

/** True when a lock has been set up (metadata present). Synchronous —
 *  the boot path uses this to decide whether to show the unlock gate. */
export function isLockEnabled(): boolean {
  return readMeta() !== null;
}

/** True when the current session holds the derived key (post-unlock). */
export function isUnlocked(): boolean {
  return sessionKey !== null;
}

/** The session key, or null when locked. Threaded into persistence. */
export function getSessionKey(): CryptoKey | null {
  return sessionKey;
}

/**
 * Turn the lock on for the first time. Derives a key from the PIN, stores
 * salt + verifier, and keeps the key in memory so the CURRENT session
 * stays usable (the gate only appears on the next cold load). Returns the
 * key so the caller can immediately re-encrypt existing data with it.
 */
export async function enableLock(pin: string): Promise<CryptoKey> {
  const salt = randomSaltB64();
  const key = await deriveKey(pin, salt);
  const verifier = await encryptString(key, VERIFIER_PLAINTEXT);
  const meta: LockMeta = { v: 1, salt, verifier };
  window.localStorage.setItem(LOCK_KEY, JSON.stringify(meta));
  sessionKey = key;
  return key;
}

/**
 * Attempt to unlock with a PIN. Returns true (and sets the session key)
 * only if the PIN re-derives a key that decrypts the verifier. Wrong PIN
 * → false, key untouched.
 */
export async function unlock(pin: string): Promise<boolean> {
  const meta = readMeta();
  if (!meta) return false;
  const key = await deriveKey(pin, meta.salt);
  const check = await decryptString(key, meta.verifier);
  if (check !== VERIFIER_PLAINTEXT) return false;
  sessionKey = key;
  return true;
}

/** Drop the in-memory key (re-lock). Data stays encrypted at rest. */
export function lock(): void {
  sessionKey = null;
}

/**
 * Remove the lock metadata + session key. The caller MUST have already
 * rewritten any encrypted data as plaintext first (disabling the lock) —
 * this just clears the lock itself.
 */
export function clearLockMeta(): void {
  try {
    window.localStorage.removeItem(LOCK_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
  sessionKey = null;
}
