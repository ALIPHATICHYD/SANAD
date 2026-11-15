// 48 simulated vignettes (40 core + 8 edge cases). Synthetic: no real patient data.
// Expected next step was labelled by the team from AUA/ASRM 2020, EAU SRH 2024
// and NICE NG12 BEFORE running the engine. Labels are pending independent
// clinician adjudication (planned in pilot, see deck).
// `group` and `lang` are NOT engine inputs; they exist only to test fairness.

import type { Answers } from './questions';
import type { Level } from './engine';

export type Case = { id: string; story: string; expected: Level; ageBand: '18-29' | '30-39' | '40-49' | '50+'; group: string; lang: 'en' | 'ar'; a: Answers };

const base: Answers = { rfAcutePain: 'no', rfPainFever: 'no', rfPriapism: 'no', rfLump: 'no', hx: ['none'], ed: 'never', ejac: 'none', diabetes: 'no', bp: 'no', utiNow: 'no', infHx: 'no', testosterone: 'never', meds: ['none'], smoke: 'never', heat: ['none'], chem: 'no' };
const c = (id: string, expected: Level, ageBand: Case['ageBand'], group: string, lang: 'en' | 'ar', story: string, extra: Answers): Case => ({ id, story, expected, ageBand, group, lang, a: { ...base, ...extra } });

export const CASES: Case[] = [
  // Urgent (red flags)
  c('V01', 'urgent', '18-29', 'Emirati', 'ar', '19, sudden left testicular pain for 2 hours after football', { age: 19, reason: 'concern', rfAcutePain: 'yes', height: 178, weight: 70 }),
  c('V02', 'urgent', '30-39', 'South Asian', 'en', '34, painful swollen scrotum with fever 38.6', { age: 34, reason: 'concern', rfPainFever: 'yes', height: 170, weight: 82 }),
  c('V03', 'urgent', '40-49', 'Arab expat', 'ar', '45, erection 5 hours after injection therapy', { age: 45, reason: 'concern', rfPriapism: 'yes', ed: 'often' }),
  c('V04', 'urgent', '18-29', 'African', 'en', '23, trying 14 months AND acute testicular pain today', { age: 23, reason: 'trying', tryingMonths: 14, rfAcutePain: 'yes' }),
  c('V05', 'urgent', '30-39', 'Western', 'en', '31, scrotal swelling with redness and fever, history of epididymitis', { age: 31, reason: 'checkup', rfPainFever: 'yes', infHx: 'yes' }),
  c('V06', 'urgent', '50+', 'Emirati', 'ar', '58, sudden severe testicular pain overnight', { age: 58, reason: 'concern', rfAcutePain: 'yes', diabetes: 'controlled' }),
  // Specialist
  c('V07', 'specialist', '18-29', 'Emirati', 'ar', '27, painless hard lump in right testicle for 3 weeks', { age: 27, reason: 'concern', rfLump: 'yes', height: 180, weight: 77 }),
  c('V08', 'specialist', '30-39', 'Arab expat', 'ar', '33, gym user on testosterone injections, trying 4 months', { age: 33, reason: 'trying', tryingMonths: 4, testosterone: 'current', height: 182, weight: 90 }),
  c('V09', 'specialist', '30-39', 'South Asian', 'en', '36, semen report shows zero sperm', { age: 36, reason: 'trying', tryingMonths: 18, sConc: 0, sVol: 2.5 }),
  c('V10', 'specialist', '18-29', 'Western', 'en', '29, childhood undescended testicle, planning family', { age: 29, reason: 'planning', hx: ['undescended'] }),
  c('V11', 'specialist', '30-39', 'African', 'en', '38, lymphoma treated with chemo at 24, now trying', { age: 38, reason: 'trying', tryingMonths: 5, hx: ['cancerTx'] }),
  c('V12', 'specialist', '40-49', 'Emirati', 'ar', '42, concentration 2.1 M/mL on report', { age: 42, reason: 'trying', tryingMonths: 20, sConc: 2.1, sProg: 18 }),
  c('V13', 'specialist', '30-39', 'Arab expat', 'ar', '35, very little ejaculate since diabetes diagnosis', { age: 35, reason: 'concern', ejac: 'absent', diabetes: 'uncontrolled' }),
  c('V14', 'specialist', '40-49', 'Western', 'en', '44, vasectomy 6 years ago, remarried and wants children', { age: 44, reason: 'planning', hx: ['vasectomy'] }),
  c('V15', 'specialist', '18-29', 'South Asian', 'en', '26, "bag of worms" feeling left scrotum, trying 7 months', { age: 26, reason: 'trying', tryingMonths: 7, hx: ['varicocele'] }),
  c('V16', 'specialist', '30-39', 'Emirati', 'ar', '32, FSH 14 IU/L on a previous test', { age: 32, reason: 'trying', tryingMonths: 9, fsh: 14 }),
  c('V17', 'specialist', '30-39', 'African', 'en', '37, known cystic fibrosis carrier status, planning', { age: 37, reason: 'planning', hx: ['genetic'] }),
  // Fertility
  c('V18', 'fertility', '30-39', 'Emirati', 'ar', '31, trying 14 months, no other issues', { age: 31, reason: 'trying', tryingMonths: 14, height: 175, weight: 72 }),
  c('V19', 'fertility', '30-39', 'South Asian', 'en', '39, trying 8 months, wife is 37', { age: 39, reason: 'trying', tryingMonths: 8, partner35: 'yes' }),
  c('V20', 'fertility', '40-49', 'Arab expat', 'ar', '41, trying 24 months, smoker', { age: 41, reason: 'trying', tryingMonths: 24, smoke: 'current' }),
  c('V21', 'fertility', '18-29', 'Western', 'en', '28, home test then lab: conc 11 M/mL, motility 25%', { age: 28, reason: 'concern', sConc: 11, sProg: 25 }),
  c('V22', 'fertility', '30-39', 'African', 'en', '34, trying 13 months, outdoor construction worker', { age: 34, reason: 'trying', tryingMonths: 13, heat: ['outdoor'] }),
  c('V23', 'fertility', '30-39', 'Emirati', 'ar', '36, trying 7 months, wife 36, BMI 31', { age: 36, reason: 'trying', tryingMonths: 7, partner35: 'yes', height: 172, weight: 92 }),
  c('V24', 'fertility', '18-29', 'Arab expat', 'ar', '25, morphology 2% on report, others normal', { age: 25, reason: 'planning', sConc: 40, sProg: 45, sMorph: 2, sVol: 2.8 }),
  // Primary care
  c('V25', 'primary', '40-49', 'Emirati', 'ar', '47, frequent erection problems, never had sugar tested', { age: 47, reason: 'concern', ed: 'often', diabetes: 'unknown' }),
  c('V26', 'primary', '30-39', 'South Asian', 'en', '33, BMI 34, planning family', { age: 33, reason: 'planning', height: 168, weight: 96 }),
  c('V27', 'primary', '18-29', 'Western', 'en', '24, burning urine and discharge this week', { age: 24, reason: 'concern', utiNow: 'yes' }),
  c('V28', 'primary', '30-39', 'Arab expat', 'ar', '35, on finasteride for hair, trying 3 months', { age: 35, reason: 'trying', tryingMonths: 3, meds: ['finasteride'] }),
  c('V29', 'primary', '40-49', 'African', 'en', '43, low drive and tired for a year', { age: 43, reason: 'checkup', lowT: 'yes', height: 176, weight: 88 }),
  c('V30', 'primary', '50+', 'Emirati', 'ar', '52, uncontrolled diabetes, general check', { age: 52, reason: 'checkup', diabetes: 'uncontrolled', bp: 'yes' }),
  c('V31', 'primary', '18-29', 'Emirati', 'ar', '29, stopped steroids 8 months ago, planning', { age: 29, reason: 'planning', testosterone: 'past' }),
  c('V32', 'primary', '30-39', 'Western', 'en', '38, testosterone 9.5 nmol/L on a wellness panel', { age: 38, reason: 'checkup', tT: 9.5 }),
  c('V33', 'primary', '50+', 'South Asian', 'en', '55, unsure about recent testicular pain, otherwise well', { age: 55, reason: 'checkup', rfAcutePain: 'unsure' }),
  // Self-care
  c('V34', 'selfcare', '18-29', 'Emirati', 'ar', '22, healthy, curious before marriage', { age: 22, reason: 'planning', height: 177, weight: 70 }),
  c('V35', 'selfcare', '30-39', 'Arab expat', 'ar', '30, shisha smoker, drives 4 hours a day', { age: 30, reason: 'planning', smoke: 'current', heat: ['driving'] }),
  c('V36', 'selfcare', '18-29', 'South Asian', 'en', '27, trying 5 months, healthy', { age: 27, reason: 'trying', tryingMonths: 5, partner35: 'no' }),
  c('V37', 'selfcare', '30-39', 'African', 'en', '32, BMI 27, works with paints', { age: 32, reason: 'checkup', height: 180, weight: 88, chem: 'yes' }),
  c('V38', 'selfcare', '40-49', 'Western', 'en', '46, normal semen analysis, wants reassurance', { age: 46, reason: 'checkup', sConc: 48, sVol: 3, sProg: 40, sMorph: 6 }),
  c('V39', 'selfcare', '18-29', 'Emirati', 'ar', '21, past treated infection, no symptoms', { age: 21, reason: 'checkup', infHx: 'yes' }),
  c('V40', 'selfcare', '50+', 'Arab expat', 'ar', '51, high blood pressure on treatment, curious', { age: 51, reason: 'checkup', bp: 'yes' }),
  // Edge cases added after v1.2 review (ambiguous or partially answered)
  c('E01', 'selfcare', '30-39', 'Arab expat', 'ar', '30, occasional erection trouble, BMI 29, smoker', { age: 30, reason: 'checkup', ed: 'sometimes', height: 175, weight: 89, smoke: 'current' }),
  c('E02', 'fertility', '40-49', 'South Asian', 'en', '40, trying 11 months, does not know if wife is 35+', { age: 40, reason: 'trying', tryingMonths: 11, partner35: 'unsure' }),
  c('E03', 'primary', '18-29', 'African', 'en', '25, mumps orchitis at 16, planning', { age: 25, reason: 'planning', hx: ['mumps'] }),
  c('E04', 'primary', '30-39', 'Emirati', 'ar', '36, frequent ED, diabetes controlled, trying 2 months', { age: 36, reason: 'trying', tryingMonths: 2, ed: 'often', diabetes: 'controlled' }),
  c('E05', 'fertility', '30-39', 'Western', 'en', '34, conc 14 M/mL, motility 32%, BMI 31', { age: 34, reason: 'planning', sConc: 14, sProg: 32, height: 178, weight: 99 }),
  c('E06', 'primary', '18-29', 'Emirati', 'ar', '19, not sure about a lump, anxious', { age: 19, reason: 'concern', rfLump: 'unsure' }),
  c('E07', 'fertility', '40-49', 'Arab expat', 'ar', '48, trying 30 months, steroids in the past, smoker', { age: 48, reason: 'trying', tryingMonths: 30, testosterone: 'past', smoke: 'current' }),
  c('E08', 'selfcare', '30-39', 'African', 'en', '35, outdoor work, solvents, trying 10 months, wife under 35', { age: 35, reason: 'trying', tryingMonths: 10, partner35: 'no', heat: ['outdoor'], chem: 'yes' }),
];
