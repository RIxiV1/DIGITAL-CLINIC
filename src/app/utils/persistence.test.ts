// @vitest-environment jsdom
/**
 * Tests for the AI auto-fallback persistence helpers.
 *
 * The setting drives ProcessingPage's decision to cascade automatically
 * to the Vision-LLM fallback when local parsing fails on an image. A
 * regression in defaulting, schema validation, or write semantics could
 * either:
 *   - Make auto-cascade silently stop working (default flips to false)
 *   - Make a hostile localStorage write crash the app at boot
 *   - Drop the user's explicit opt-out and re-enable cascade behind
 *     their back
 * All three are real harms — hence the focused test pass here.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadAiAutoFallbackSetting,
  saveAiAutoFallbackSetting,
} from './persistence';

const KEY = 'dc_aiAutoFallback';

describe('AI auto-fallback persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to true when no value has been written', () => {
    expect(loadAiAutoFallbackSetting()).toBe(true);
  });

  it('round-trips true through save → load', () => {
    saveAiAutoFallbackSetting(true);
    expect(loadAiAutoFallbackSetting()).toBe(true);
  });

  it('round-trips false through save → load (user opt-out persists)', () => {
    saveAiAutoFallbackSetting(false);
    expect(loadAiAutoFallbackSetting()).toBe(false);
  });

  it('falls back to default when the stored value is malformed JSON', () => {
    localStorage.setItem(KEY, '{not-json}');
    expect(loadAiAutoFallbackSetting()).toBe(true);
  });

  it('falls back to default when the stored value is the wrong type', () => {
    // A future-bug write that stuffed a string into the boolean slot
    // shouldn't crash the app — schema validation catches it and we
    // return the default. The user can re-set their preference in
    // Profile without losing anything else.
    localStorage.setItem(KEY, JSON.stringify('yes'));
    expect(loadAiAutoFallbackSetting()).toBe(true);
  });

  it('treats an explicit false-write as preference, not "unset"', () => {
    // Bug-class guard: writing `false` is semantically different from
    // "no value yet." If load ever conflated the two we'd silently
    // re-enable cascade for users who'd opted out, which is the
    // privacy-relevant failure mode.
    saveAiAutoFallbackSetting(false);
    // Reload from localStorage (simulating a page refresh / app boot).
    const persisted = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    expect(persisted).toBe(false);
    expect(loadAiAutoFallbackSetting()).toBe(false);
  });
});
