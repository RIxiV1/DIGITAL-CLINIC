import { describe, it, expect } from 'vitest';
import {
  deriveKey,
  encryptString,
  decryptString,
  randomSaltB64,
} from './crypto';

describe('crypto — AES-GCM round trip + PIN safety', () => {
  it('round-trips a string with the same PIN + salt', async () => {
    const salt = randomSaltB64();
    const key = await deriveKey('1234', salt);
    const blob = await encryptString(key, 'Total Testosterone 612 ng/dL');
    // re-derive from the same PIN + salt (simulates a fresh unlock)
    const key2 = await deriveKey('1234', salt);
    expect(await decryptString(key2, blob)).toBe('Total Testosterone 612 ng/dL');
  });

  it('returns null for the wrong PIN (no throw)', async () => {
    const salt = randomSaltB64();
    const blob = await encryptString(await deriveKey('1234', salt), 'secret');
    const wrong = await deriveKey('9999', salt);
    expect(await decryptString(wrong, blob)).toBeNull();
  });

  it('returns null for tampered ciphertext', async () => {
    const salt = randomSaltB64();
    const key = await deriveKey('1234', salt);
    const blob = await encryptString(key, 'secret');
    const tampered = { ...blob, data: blob.data.slice(0, -4) + 'AAAA' };
    expect(await decryptString(key, tampered)).toBeNull();
  });

  it('uses a fresh IV each time (same plaintext → different ciphertext)', async () => {
    const key = await deriveKey('1234', randomSaltB64());
    const a = await encryptString(key, 'same');
    const b = await encryptString(key, 'same');
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('different salts derive different keys from the same PIN', async () => {
    const blob = await encryptString(await deriveKey('1234', randomSaltB64()), 'x');
    const otherKey = await deriveKey('1234', randomSaltB64());
    expect(await decryptString(otherKey, blob)).toBeNull();
  });
});
