import { describe, expect, it } from 'vitest';
import { certaintyOfAction } from './certaintyOfAction';

describe('certaintyOfAction', () => {
  it('maps each tier to an ACTION, never a diagnosis', () => {
    expect(certaintyOfAction({ status: 'critical' }).action).toMatch(/doctor/i);
    expect(certaintyOfAction({ status: 'concern' }).action).toMatch(/doctor/i);
    expect(certaintyOfAction({ status: 'attention' }).action).toMatch(
      /eye|retest/i,
    );
    expect(certaintyOfAction({ status: 'good' }).action).toMatch(/schedule/i);
  });

  it('radiates certainty about the action even when meaning is uncertain', () => {
    // The whole point: action-certainty is reliably high.
    for (const status of ['critical', 'concern', 'attention', 'good'] as const) {
      expect(certaintyOfAction({ status }).certainty).toBe('high');
    }
  });

  it('prioritizes verifying the input when it was read off an unclear photo', () => {
    // A misread can land in any tier — input integrity comes first.
    const a = certaintyOfAction({ status: 'good', ocrConfidence: 40 });
    expect(a.action).toMatch(/double-check/i);
    expect(a.certainty).toBe('high');
  });

  it('does not override on a confident photo read', () => {
    expect(
      certaintyOfAction({ status: 'concern', ocrConfidence: 90 }).action,
    ).toMatch(/doctor/i);
  });

  it('never phrases the output as a diagnosis', () => {
    for (const status of ['critical', 'concern', 'attention', 'good'] as const) {
      const { action, detail } = certaintyOfAction({ status });
      expect(`${action} ${detail}`).not.toMatch(
        /you have|diagnos|you are (diabetic|hypogonadal|deficient)/i,
      );
    }
  });
});
