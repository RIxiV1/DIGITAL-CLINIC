/**
 * Discreet Mode context. Holds the on/off preference (persisted) and is
 * shared by the Profile toggle and the <PrivacyScreen> veil.
 *
 * When on, PrivacyScreen obscures all content the instant the app loses
 * focus or is backgrounded — the PRD's core "discretion" promise. Like
 * language (and unlike theme), this isn't a first-paint-correctness
 * concern, so a normal context seeded from localStorage is enough — no
 * inline <head> bootstrap needed.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loadDiscreetMode, saveDiscreetMode } from '../utils/persistence';

type DiscreetValue = {
  discreet: boolean;
  setDiscreet: (on: boolean) => void;
  /** Bumps each time the user hits "hide now" — PrivacyScreen watches this
   *  and raises the veil immediately, regardless of the Discreet setting.
   *  A nonce (not a boolean) so repeated taps always re-trigger. */
  concealNonce: number;
  concealNow: () => void;
};

const DiscreetContext = createContext<DiscreetValue | null>(null);

export function DiscreetProvider({ children }: { children: ReactNode }) {
  const [discreet, setDiscreetState] = useState<boolean>(() =>
    loadDiscreetMode(),
  );

  const setDiscreet = useCallback((on: boolean) => {
    setDiscreetState(on);
    saveDiscreetMode(on);
  }, []);

  const [concealNonce, setConcealNonce] = useState(0);
  const concealNow = useCallback(() => setConcealNonce((n) => n + 1), []);

  const value = useMemo<DiscreetValue>(
    () => ({ discreet, setDiscreet, concealNonce, concealNow }),
    [discreet, setDiscreet, concealNonce, concealNow],
  );

  return (
    <DiscreetContext.Provider value={value}>
      {children}
    </DiscreetContext.Provider>
  );
}

export function useDiscreet(): DiscreetValue {
  const ctx = useContext(DiscreetContext);
  if (!ctx) {
    throw new Error('useDiscreet must be used within a DiscreetProvider');
  }
  return ctx;
}
