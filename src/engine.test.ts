import { describe, expect, it } from 'vitest';
import { assess } from './engine';
import { runEval } from './eval';
import { CASES } from './cases';
import { packShare, openShare } from './share';

describe('Sanad engine', () => {
  const r = runEval();
  it('catches every red flag (100% sensitivity on urgent cases)', () => expect(r.redFlagSensitivity).toBe(1));
  it('never under-triages a simulated case', () => expect(r.under).toBe(0));
  it('stays urgent when any non-safety answer is missing', () => expect(r.robustness.unsafeDrops).toBe(0));
  it('agrees with the expected next step on at least 90% of vignettes', () => expect(r.accuracy).toBeGreaterThanOrEqual(0.9));
  it('treats an unsure red-flag answer as not-safe-for-self-care', () => {
    expect(assess({ rfAcutePain: 'unsure' }).level).not.toBe('selfcare');
  });
  it('is deterministic and records its reasoning', () => {
    const a = CASES[7].a;
    expect(assess(a)).toEqual(assess(a));
    expect(assess(a).trace).toContain('EX-TESTO');
  });
  it('never reads protected or identity fields', () => {
    const a = { ...CASES[20].a };
    expect(assess({ ...a, nationality: 'X', religion: 'Y', name: 'Z' } as never).level).toBe(assess(a).level);
  });
});

describe('share pack', () => {
  it('round-trips with the right PIN and fails with the wrong one', async () => {
    const payload = { v: 1 as const, exp: Date.now() + 60_000, level: 'primary', signals: ['FN-ED'], fields: { age: 40 } };
    const token = await packShare(payload, '482913');
    expect(token).not.toContain('FN-ED');
    expect(await openShare(token, '482913')).toEqual(payload);
    await expect(openShare(token, '000000')).rejects.toThrow();
  });
});
