import { assess, LEVEL_RANK, type Level } from './engine';
import { CASES, type Case } from './cases';

export type Row = { c: Case; got: Level; ok: boolean; under: boolean; over: boolean; ms: number };
export type Report = {
  n: number; accuracy: number; under: number; over: number;
  redFlagSensitivity: number; redFlagN: number;
  byGroup: Record<string, { n: number; acc: number }>;
  byAge: Record<string, { n: number; acc: number }>;
  byLang: Record<string, { n: number; acc: number }>;
  robustness: { dropped: number; unsafeDrops: number };
  confusion: Record<Level, Record<Level, number>>;
  rows: Row[]; medianMs: number;
};

const LV: Level[] = ['urgent', 'specialist', 'fertility', 'primary', 'selfcare'];

function bucket(rows: Row[], key: (r: Row) => string) {
  const out: Record<string, { n: number; acc: number }> = {};
  for (const r of rows) { const k = key(r); out[k] ??= { n: 0, acc: 0 }; out[k].n++; out[k].acc += r.ok ? 1 : 0; }
  for (const k in out) out[k].acc = out[k].acc / out[k].n;
  return out;
}

export function runEval(cases: Case[] = CASES): Report {
  const rows: Row[] = cases.map((c) => {
    const t0 = performance.now();
    const got = assess(c.a).level;
    const ms = performance.now() - t0;
    const d = LEVEL_RANK[got] - LEVEL_RANK[c.expected];
    return { c, got, ok: d === 0, under: d < 0, over: d > 0, ms };
  });
  const rf = rows.filter((r) => r.c.expected === 'urgent');
  const confusion = Object.fromEntries(LV.map((e) => [e, Object.fromEntries(LV.map((g) => [g, 0]))])) as Report['confusion'];
  rows.forEach((r) => confusion[r.c.expected][r.got]++);

  // Robustness: drop every non-safety answer one at a time. A red-flag case
  // must never fall below "urgent" because something else went unanswered.
  let dropped = 0, unsafeDrops = 0;
  for (const c of cases) {
    for (const k of Object.keys(c.a)) {
      if (k.startsWith('rf')) continue;
      const a = { ...c.a }; delete a[k]; dropped++;
      if (c.expected === 'urgent' && assess(a).level !== 'urgent') unsafeDrops++;
    }
  }
  const ms = rows.map((r) => r.ms).sort((x, y) => x - y);
  return {
    n: rows.length,
    accuracy: rows.filter((r) => r.ok).length / rows.length,
    under: rows.filter((r) => r.under).length,
    over: rows.filter((r) => r.over).length,
    redFlagSensitivity: rf.filter((r) => r.got === 'urgent').length / rf.length,
    redFlagN: rf.length,
    byGroup: bucket(rows, (r) => r.c.group),
    byAge: bucket(rows, (r) => r.c.ageBand),
    byLang: bucket(rows, (r) => (r.c.lang === 'ar' ? 'Arabic' : 'English')),
    robustness: { dropped, unsafeDrops },
    confusion, rows, medianMs: ms[Math.floor(ms.length / 2)],
  };
}
