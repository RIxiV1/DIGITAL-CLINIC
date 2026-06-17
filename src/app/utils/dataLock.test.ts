// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isLockEnabled,
  isUnlocked,
  getSessionKey,
  enableLock,
  unlock,
  lock,
  clearLockMeta,
} from './dataLock';
import {
  saveReportsMaybeEncrypted,
  loadReportsMaybeEncrypted,
  reportsAreEncrypted,
  loadReports,
} from './persistence';

const sample = [
  {
    id: 'r1',
    name: 'My panel',
    lab: 'Manual entry',
    uploadedOn: '16 Jun 2026',
    status: 'ready',
    biomarkers: [],
  },
];

beforeEach(() => {
  localStorage.clear();
  lock(); // drop any session key from a prior test
});

describe('dataLock + encrypted persistence', () => {
  it('enables the lock and encrypts reports at rest', async () => {
    const key = await enableLock('1234');
    expect(isLockEnabled()).toBe(true);
    expect(isUnlocked()).toBe(true);

    await saveReportsMaybeEncrypted(sample, key);
    expect(reportsAreEncrypted()).toBe(true);
    // Raw plaintext loader can't read it (it's ciphertext now).
    expect(loadReports()).toEqual([]);
    // With the key, it round-trips.
    const out = await loadReportsMaybeEncrypted(getSessionKey());
    expect(out).toHaveLength(1);
    expect((out[0] as { id: string }).id).toBe('r1');
  });

  it('locks → cannot read without the key; unlock with right PIN restores', async () => {
    const key = await enableLock('1234');
    await saveReportsMaybeEncrypted(sample, key);

    lock();
    expect(isUnlocked()).toBe(false);
    expect(await loadReportsMaybeEncrypted(null)).toEqual([]);

    expect(await unlock('9999')).toBe(false); // wrong PIN
    expect(isUnlocked()).toBe(false);

    expect(await unlock('1234')).toBe(true); // right PIN
    expect((await loadReportsMaybeEncrypted(getSessionKey())).length).toBe(1);
  });

  it('plaintext data (no lock) loads via the encrypted-aware loader too', async () => {
    await saveReportsMaybeEncrypted(sample, null); // no key → plaintext
    expect(reportsAreEncrypted()).toBe(false);
    expect((await loadReportsMaybeEncrypted(null)).length).toBe(1);
  });

  it('clearLockMeta removes the lock', async () => {
    await enableLock('1234');
    clearLockMeta();
    expect(isLockEnabled()).toBe(false);
    expect(isUnlocked()).toBe(false);
  });
});
