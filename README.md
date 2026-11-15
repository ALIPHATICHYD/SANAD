# Sanad · سند

A private, bilingual, explainable front door for men's reproductive health.
Built for the Future Health Digital Innovation Challenge (Fertility · Challenge 01: Male Reproductive Health).

**Live prototype:** https://sanad-health-psi.vercel.app (no login; clinician demo PIN `246810` via "Load a demo pack")

> Sanad is a screening and navigation aid. It does not diagnose and does not replace a clinician. All test data is simulated.

## What it does

1. **Safety first.** Four red-flag questions (torsion, infection, priapism, lump) run before anything else and stop the check with emergency guidance when needed.
2. **Private intake (English / العربية).** History, sexual health, metabolism, infection, medicines and heat exposure, plus optional semen and hormone results. Every question can be skipped. No name, ID, nationality, religion or marital status is ever asked.
3. **Explainable signals.** 33 versioned rules derived from WHO 2021, AUA/ASRM 2020/2024, EAU SRH 2024 and NICE NG12. Each signal has a plain-language reason, a source and a rule ID, split into "things you can change" and "things to discuss".
4. **Five-level triage.** Self-care, primary care, couple fertility assessment, urology/andrology, or urgent. The highest level wins; an unsure red-flag answer is never treated as "no".
5. **User-controlled sharing.** The user picks which fields to share. The pack is compressed and encrypted on the device (AES-256-GCM, key from PBKDF2-SHA256 over a 6-digit PIN, 210k iterations) and carried in the URL fragment, so no server ever sees it.
6. **Human oversight.** A clinician opens the pack with the PIN, reviews the reasoning and confirms or overrides (reason required). Decisions go to an audit log with the engine version.
7. **Evidence page.** 48 simulated vignettes, a confusion matrix, fairness by group, age and language, and a missing-answer robustness test, all computed live in the browser from the same engine.

## Run it

```bash
npm install
npm run dev      # local app
npm test         # 8 tests: red-flag sensitivity, no under-triage, robustness, crypto round-trip
npm run build
```

## Layout

| Path | What |
| --- | --- |
| `src/engine.ts` | Rules, triage levels, fail-safes |
| `src/questions.ts` | Bilingual intake schema |
| `src/cases.ts` | 48 simulated vignettes with expected next step |
| `src/eval.ts` | Evaluation harness (agreement, under-triage, fairness, robustness) |
| `src/share.ts` | Encrypted share pack |
| `src/main.ts` | App views: home, consent, check, result, share, clinician, evidence, privacy |
| `docs/` | Architecture diagram and deck builder |

## Licences

Original code and content © the Sanad team. Dependencies: Vite and Vitest (MIT), TypeScript (Apache-2.0), qrcode (MIT). Fonts: IBM Plex (SIL OFL 1.1).
