// @vitest-environment jsdom
/**
 * Guards one clinical-language rule: the bar's zone LABELS must agree with
 * its zone COLOURS about which direction is bad.
 *
 * This was wrong in shipped code. "Critical low / Critical high" were
 * hard-coded, so the 14 markers where higher is better — testosterone,
 * free-T, HDL, eGFR, vitamin D, B12, folate, albumin and the sperm panel —
 * labelled their GOOD end "CRITICAL HIGH", over a zone the same component
 * (correctly) shaded mild amber. On a men's hormonal health app, the bar
 * called high testosterone critical.
 *
 * It's worth a test rather than a one-time fix because the failure is
 * invisible: everything typechecks, the colours stay right, and the only
 * symptom is a word contradicting a colour on a screen nobody re-reads.
 * The comprehension literature (Zikmund-Fisher et al., JMIR 2014;16(8):e187,
 * n=1,817) is blunt about why it matters — a display can say "out of range"
 * while leaving "is high bad HERE?" unanswered, and only ~51% of adults get
 * that right unaided.
 *
 * Note on jsdom: the long labels live in `hidden sm:inline` spans. Tailwind
 * classes don't apply in jsdom, so both the short and long variants are in
 * the tree — which is exactly what we want to assert on.
 */

import { render, cleanup, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import BiomarkerBar from './BiomarkerBar';
import { biomarkerCatalog } from '../data/biomarkerCatalog';
import type { Biomarker } from '../data/biomarkers';

afterEach(cleanup);

const marker = (over: Partial<Biomarker>): Biomarker => ({
  id: 'test',
  name: 'Test Marker',
  value: 50,
  unit: 'mg/dL',
  min: 40,
  max: 100,
  status: 'good',
  category: 'heart',
  plain: 'A test marker.',
  ...over,
});

describe('BiomarkerBar zone labels follow direction', () => {
  it('never calls the GOOD end critical when higher is better (HDL)', () => {
    render(<BiomarkerBar marker={marker({ id: 'hdl', name: 'HDL', direction: 'up' })} />);
    // The high end is the desirable one — amber at worst, never "critical".
    expect(screen.queryByText('Critical high')).toBeNull();
    expect(screen.getByText('Very high')).toBeTruthy();
    // The low end IS the dangerous one for an "up" marker — keep it critical.
    expect(screen.getByText('Critical low')).toBeTruthy();
  });

  it('never calls the GOOD end critical when lower is better (LDL)', () => {
    render(<BiomarkerBar marker={marker({ id: 'ldl', name: 'LDL', direction: 'down' })} />);
    expect(screen.queryByText('Critical low')).toBeNull();
    expect(screen.getByText('Very low')).toBeTruthy();
    expect(screen.getByText('Critical high')).toBeTruthy();
  });

  it('keeps BOTH ends critical when either extreme is dangerous (band)', () => {
    render(<BiomarkerBar marker={marker({ direction: 'band' })} />);
    expect(screen.getByText('Critical low')).toBeTruthy();
    expect(screen.getByText('Critical high')).toBeTruthy();
  });

  it('defaults to band when a marker declares no direction', () => {
    render(<BiomarkerBar marker={marker({ direction: undefined })} />);
    expect(screen.getByText('Critical low')).toBeTruthy();
    expect(screen.getByText('Critical high')).toBeTruthy();
  });

  /* The rule is only worth anything if the catalog still agrees that these
     markers are "higher is better". If someone flips testosterone to 'band',
     the component tests above still pass while the product regresses. */
  it("the catalog still says the app's signature markers are higher-is-better", () => {
    const dirOf = (id: string) =>
      biomarkerCatalog.find((t) => t.id === id)?.direction;
    for (const id of ['testosterone', 'free-t', 'hdl', 'egfr', 'vit-d']) {
      expect(dirOf(id), `${id} should be direction 'up'`).toBe('up');
    }
  });
});
