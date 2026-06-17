/**
 * Client-side encryption primitives for the optional at-rest data lock.
 *
 * AES-GCM with a 256-bit key derived from the user's PIN via PBKDF2-
 * SHA256. Everything runs in the browser (Web Crypto) — no key or
 * plaintext ever leaves the device, and the derived key is held only in
 * memory for the session (never persisted).
 *
 * Threat model: protects locally-stored lab data against casual access
 * on a shared/unlocked device. A 4–6 digit PIN is low-entropy, so the
 * high PBKDF2 iteration count is what makes an offline brute-force of an
 * exported blob expensive rather than instant; it is NOT a defence
 * against a determined attacker with unlimited offline compute. That
 * trade-off is the product decision (PIN over passphrase for usability).
 */

/** PBKDF2 work factor. 200k SHA-256 iterations ≈ a few hundred ms on a
 *  mid phone — unlock stays snappy, but each brute-force guess of an
 *  exported blob pays the same cost. */
const PBKDF2_ITERATIONS = 200_000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // 96-bit nonce, the AES-GCM standard

/** AES-GCM ciphertext + the fresh IV it was sealed with. Both base64. */
export type EncryptedBlob = {
  iv: string;
  data: string;
};

/** Web Crypto handle. `globalThis.crypto` is standard in browsers and in
 *  Node ≥ 20 (the project's engine floor), so this works in the app and
 *  in the node-env test runner alike. */
const webcrypto: Crypto = globalThis.crypto;

function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** Fresh random salt (base64) — store it alongside the lock so the same
 *  PIN re-derives the same key on the next unlock. */
export function randomSaltB64(): string {
  return toB64(webcrypto.getRandomValues(new Uint8Array(SALT_BYTES)));
}

/** Derive the AES-GCM key from a PIN + stored salt. Non-extractable. */
export async function deriveKey(pin: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return webcrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromB64(saltB64) as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt a UTF-8 string with a fresh IV. */
export async function encryptString(
  key: CryptoKey,
  plaintext: string,
): Promise<EncryptedBlob> {
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext) as BufferSource,
  );
  return { iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
}

/** Decrypt a blob. Returns null on any failure (wrong key — i.e. wrong
 *  PIN — or tampered/corrupt ciphertext), so callers treat a null as
 *  "couldn't unlock" without a throw. */
export async function decryptString(
  key: CryptoKey,
  blob: EncryptedBlob,
): Promise<string | null> {
  try {
    const pt = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(blob.iv) as BufferSource },
      key,
      fromB64(blob.data) as BufferSource,
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}
