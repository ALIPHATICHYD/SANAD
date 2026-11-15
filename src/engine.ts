// Sanad screening engine.
// Deterministic, versioned, explainable rules. No model weights, no hidden
// features, no protected attributes. Every output carries the rule IDs that
// produced it so a clinician can audit the reasoning line by line.
//
// This is SCREENING support, not diagnosis. Thresholds come from published
// guidance (WHO 2021 semen manual, AUA/ASRM 2020/2024 male infertility,
// EAU Sexual & Reproductive Health 2024). See /evidence in the app.

import type { Answers, T } from './questions';

export const ENGINE_VERSION = 'sanad-rules-1.3.0';

export type Level = 'urgent' | 'specialist' | 'fertility' | 'primary' | 'selfcare';
export const LEVEL_RANK: Record<Level, number> = { urgent: 4, specialist: 3, fertility: 2, primary: 1, selfcare: 0 };

export type Signal = {
  id: string;
  domain: 'red-flag' | 'history' | 'function' | 'metabolic' | 'infection' | 'exposure' | 'semen' | 'hormone' | 'timing';
  level: Level;
  modifiable: boolean;
  title: T;
  why: T;
  source: string;
};

export type Result = {
  version: string;
  level: Level;
  signals: Signal[];
  completeness: number; // 0..1 share of relevant questions answered
  bmi?: number;
  redFlag: boolean;
  trace: string[]; // rule ids in firing order
};

// WHO Laboratory Manual, 6th ed. (2021): 5th centile lower reference limits
export const WHO_2021 = { volume: 1.4, concentration: 16, progressive: 30, morphology: 4 };

const yes = (v: unknown) => v === 'yes';
const has = (v: unknown, k: string) => Array.isArray(v) && v.includes(k);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

type Rule = { id: string; when: (a: Answers, d: Derived) => boolean; signal: Omit<Signal, 'id'> };
type Derived = { bmi?: number; trying: boolean; months?: number; p35: boolean };

const RULES: Rule[] = [
  // ---------- Red flags: always evaluated first, never suppressed ----------
  { id: 'RF-TORSION', when: (a) => yes(a.rfAcutePain), signal: { domain: 'red-flag', level: 'urgent', modifiable: false,
    title: { en: 'Sudden testicular pain needs same-day emergency care', ar: 'ألم الخصية المفاجئ يحتاج إلى رعاية طارئة في نفس اليوم' },
    why: { en: 'Sudden severe pain can be testicular torsion. The testicle can often be saved if treated within about 6 hours. Go to an emergency department now.', ar: 'قد يكون الألم المفاجئ الشديد التواءً في الخصية، ويمكن غالباً إنقاذها إذا عولجت خلال نحو ٦ ساعات. توجه إلى الطوارئ الآن.' },
    source: 'EAU Paediatric/Urology guidance on acute scrotum; AUA' } },
  { id: 'RF-INFECTION', when: (a) => yes(a.rfPainFever), signal: { domain: 'red-flag', level: 'urgent', modifiable: false,
    title: { en: 'Painful swelling with fever needs urgent assessment', ar: 'التورم المؤلم مع الحرارة يحتاج إلى تقييم عاجل' },
    why: { en: 'This can be a serious infection (epididymo-orchitis or abscess) that needs examination and antibiotics today.', ar: 'قد يكون ذلك عدوى خطيرة تحتاج إلى فحص ومضادات حيوية اليوم.' },
    source: 'EAU Urological Infections 2024' } },
  { id: 'RF-PRIAPISM', when: (a) => yes(a.rfPriapism), signal: { domain: 'red-flag', level: 'urgent', modifiable: false,
    title: { en: 'An erection over 4 hours is an emergency', ar: 'الانتصاب لأكثر من ٤ ساعات حالة طارئة' },
    why: { en: 'Prolonged erection can permanently damage tissue. Go to an emergency department now.', ar: 'الانتصاب المطول قد يتلف الأنسجة بشكل دائم. توجه إلى الطوارئ الآن.' },
    source: 'AUA/SMSNA Priapism Guideline 2022' } },
  { id: 'RF-LUMP', when: (a) => yes(a.rfLump), signal: { domain: 'red-flag', level: 'specialist', modifiable: false,
    title: { en: 'A testicular lump should be checked by urology within 2 weeks', ar: 'يجب فحص كتلة الخصية لدى أخصائي المسالك خلال أسبوعين' },
    why: { en: 'Most lumps are not cancer, but testicular cancer is the most common cancer in young men and is very treatable when found early. An ultrasound is quick and painless.', ar: 'معظم الكتل ليست سرطاناً، لكن سرطان الخصية هو الأكثر شيوعاً لدى الشباب ويُعالج بنجاح عند اكتشافه مبكراً. الفحص بالموجات فوق الصوتية سريع وغير مؤلم.' },
    source: 'EAU Testicular Cancer 2024; NICE NG12 (2-week pathway)' } },

  // ---------- Time trying (couple pathway) ----------
  { id: 'TM-12', when: (_a, d) => d.trying && (d.months ?? 0) >= 12, signal: { domain: 'timing', level: 'fertility', modifiable: false,
    title: { en: '12+ months trying: both partners should be assessed now', ar: 'أكثر من ١٢ شهراً من المحاولة: يجب تقييم الزوجين الآن' },
    why: { en: 'Guidelines say the male partner should be evaluated at the same time as the female partner, not after her.', ar: 'توصي الإرشادات بتقييم الرجل في نفس وقت تقييم الزوجة، وليس بعدها.' },
    source: 'AUA/ASRM Male Infertility Guideline 2020 (amended 2024), Statement 1' } },
  { id: 'TM-6-35', when: (_a, d) => d.trying && d.p35 && (d.months ?? 0) >= 6 && (d.months ?? 0) < 12, signal: { domain: 'timing', level: 'fertility', modifiable: false,
    title: { en: '6+ months trying with partner 35+ (or age unknown): assess both now', ar: 'أكثر من ٦ أشهر مع عمر الزوجة ٣٥ أو أكثر (أو غير معروف): قيّما الآن' },
    why: { en: 'When the female partner is 35 or over, assessment is recommended after 6 months rather than 12.', ar: 'عندما يكون عمر الزوجة ٣٥ أو أكثر، يُنصح بالتقييم بعد ٦ أشهر بدلاً من ١٢.' },
    source: 'ASRM Committee Opinion, Definitions of infertility (2023)' } },

  // ---------- History ----------
  { id: 'HX-CRYPT', when: (a) => has(a.hx, 'undescended'), signal: { domain: 'history', level: 'specialist', modifiable: false,
    title: { en: 'History of undescended testicle', ar: 'تاريخ خصية معلقة' },
    why: { en: 'Linked to lower sperm production and a higher lifetime risk of testicular cancer. Worth a baseline semen analysis and learning self-examination.', ar: 'مرتبط بانخفاض إنتاج الحيوانات المنوية وارتفاع خطر سرطان الخصية. يُنصح بتحليل سائل منوي أساسي وتعلم الفحص الذاتي.' },
    source: 'EAU SRH 2024; AUA/ASRM 2020' } },
  { id: 'HX-CANCER', when: (a) => has(a.hx, 'cancerTx'), signal: { domain: 'history', level: 'specialist', modifiable: false,
    title: { en: 'Previous chemotherapy or radiotherapy', ar: 'علاج كيميائي أو إشعاعي سابق' },
    why: { en: 'These can reduce or stop sperm production. A specialist can check current production and options.', ar: 'قد تقلل هذه العلاجات إنتاج الحيوانات المنوية أو توقفه. يمكن للأخصائي فحص الإنتاج الحالي والخيارات المتاحة.' },
    source: 'ASCO Fertility Preservation 2018; AUA/ASRM 2020' } },
  { id: 'HX-VASECTOMY', when: (a) => has(a.hx, 'vasectomy'), signal: { domain: 'history', level: 'specialist', modifiable: false,
    title: { en: 'Previous vasectomy', ar: 'قطع القناة الدافقة سابقاً' },
    why: { en: 'If you now want children, a urologist can discuss reversal or sperm retrieval.', ar: 'إذا كنت ترغب في الإنجاب الآن، يمكن لأخصائي المسالك مناقشة العكس أو استخراج الحيوانات المنوية.' },
    source: 'AUA Vasectomy Guideline' } },
  { id: 'HX-VARICOCELE', when: (a) => has(a.hx, 'varicocele'), signal: { domain: 'history', level: 'specialist', modifiable: false,
    title: { en: 'Possible varicocele', ar: 'احتمال دوالي الخصية' },
    why: { en: 'Found in about 15% of men and up to 35–40% of men with infertility. Often treatable when it affects semen quality.', ar: 'توجد لدى نحو ١٥٪ من الرجال وحتى ٣٥–٤٠٪ ممن يعانون من العقم، وغالباً قابلة للعلاج إذا أثرت على جودة السائل المنوي.' },
    source: 'EAU SRH 2024; AUA/ASRM 2020' } },
  { id: 'HX-GENETIC', when: (a) => has(a.hx, 'genetic'), signal: { domain: 'history', level: 'specialist', modifiable: false,
    title: { en: 'Known genetic condition', ar: 'حالة وراثية معروفة' },
    why: { en: 'Some conditions affect sperm transport or production. Specialist and genetic counselling can help plan options.', ar: 'بعض الحالات تؤثر على نقل أو إنتاج الحيوانات المنوية. تساعد الاستشارة التخصصية والوراثية في التخطيط.' },
    source: 'AUA/ASRM 2020 (genetic evaluation)' } },
  { id: 'HX-MUMPS', when: (a) => has(a.hx, 'mumps'), signal: { domain: 'history', level: 'primary', modifiable: false,
    title: { en: 'Mumps orchitis after puberty', ar: 'التهاب الخصية النكافي بعد البلوغ' },
    why: { en: 'Can reduce sperm production in some men. A semen analysis tells you where you stand.', ar: 'قد يقلل إنتاج الحيوانات المنوية لدى بعض الرجال. تحليل السائل المنوي يوضح وضعك.' },
    source: 'EAU SRH 2024' } },
  { id: 'HX-SURGERY', when: (a) => has(a.hx, 'trauma') || has(a.hx, 'hernia'), signal: { domain: 'history', level: 'primary', modifiable: false,
    title: { en: 'Previous groin or testicular injury or surgery', ar: 'إصابة أو جراحة سابقة في الخصية أو الأربية' },
    why: { en: 'Can occasionally affect the testicle or sperm ducts. Mention it at your appointment.', ar: 'قد تؤثر أحياناً على الخصية أو القنوات المنوية. اذكر ذلك في موعدك.' },
    source: 'AUA/ASRM 2020 (history)' } },

  // ---------- Function ----------
  { id: 'FN-ED', when: (a) => a.ed === 'often', signal: { domain: 'function', level: 'primary', modifiable: true,
    title: { en: 'Frequent erection difficulty', ar: 'صعوبة متكررة في الانتصاب' },
    why: { en: 'Very common and treatable. It can also be an early sign of heart or blood-vessel disease, so a GP check of sugar, cholesterol and blood pressure is worthwhile.', ar: 'شائعة جداً وقابلة للعلاج، وقد تكون علامة مبكرة لأمراض القلب والأوعية، لذا يُنصح بفحص السكر والكوليسترول والضغط لدى طبيب الأسرة.' },
    source: 'Princeton III Consensus (2012); EAU SRH 2024' } },
  { id: 'FN-EJAC', when: (a) => a.ejac === 'absent', signal: { domain: 'function', level: 'specialist', modifiable: false,
    title: { en: 'Absent or very low ejaculation', ar: 'غياب القذف أو قلته الشديدة' },
    why: { en: 'Can signal a blockage, retrograde ejaculation or nerve cause. A urologist/andrologist can test for this simply.', ar: 'قد يدل على انسداد أو قذف رجوعي أو سبب عصبي، ويمكن لأخصائي الذكورة فحص ذلك ببساطة.' },
    source: 'EAU SRH 2024' } },
  { id: 'FN-LOWT', when: (a) => yes(a.lowT), signal: { domain: 'hormone', level: 'primary', modifiable: true,
    title: { en: 'Symptoms that may fit low testosterone', ar: 'أعراض قد تتوافق مع انخفاض التستوستيرون' },
    why: { en: 'Worth a morning blood test. Do not start testosterone on your own: it switches off sperm production.', ar: 'يُنصح بفحص دم صباحي. لا تبدأ التستوستيرون من تلقاء نفسك لأنه يوقف إنتاج الحيوانات المنوية.' },
    source: 'AUA Testosterone Deficiency Guideline 2018/2024' } },

  // ---------- Metabolic ----------
  { id: 'MB-OBESE', when: (_a, d) => (d.bmi ?? 0) >= 30, signal: { domain: 'metabolic', level: 'primary', modifiable: true,
    title: { en: 'Weight in the obesity range', ar: 'وزن ضمن نطاق السمنة' },
    why: { en: 'Obesity is linked to lower sperm counts and lower testosterone. Even 5–10% weight loss can help.', ar: 'ترتبط السمنة بانخفاض عدد الحيوانات المنوية والتستوستيرون، وحتى خسارة ٥–١٠٪ من الوزن قد تساعد.' },
    source: 'Sermondade et al., Hum Reprod Update 2013 (meta-analysis)' } },
  { id: 'MB-OVER', when: (_a, d) => (d.bmi ?? 0) >= 25 && (d.bmi ?? 0) < 30, signal: { domain: 'metabolic', level: 'selfcare', modifiable: true,
    title: { en: 'Weight slightly above the healthy range', ar: 'وزن أعلى قليلاً من النطاق الصحي' },
    why: { en: 'Activity and diet changes support hormone and sperm health.', ar: 'يدعم النشاط وتحسين الغذاء صحة الهرمونات والحيوانات المنوية.' },
    source: 'Sermondade et al. 2013' } },
  { id: 'MB-DM', when: (a) => a.diabetes === 'uncontrolled' || a.diabetes === 'unknown', signal: { domain: 'metabolic', level: 'primary', modifiable: true,
    title: { en: 'Blood sugar not controlled or never checked', ar: 'سكر الدم غير مسيطر عليه أو لم يُفحص' },
    why: { en: 'Diabetes affects erections, ejaculation and sperm quality. A simple HbA1c test at primary care is the next step.', ar: 'يؤثر السكري على الانتصاب والقذف وجودة الحيوانات المنوية. الخطوة التالية فحص HbA1c بسيط لدى الرعاية الأولية.' },
    source: 'Condorelli et al., Diabetes & male fertility review 2018; ADA Standards of Care' } },
  { id: 'MB-CV', when: (a) => yes(a.bp), signal: { domain: 'metabolic', level: 'selfcare', modifiable: true,
    title: { en: 'Blood pressure or cholesterol risk', ar: 'خطر ضغط الدم أو الكوليسترول' },
    why: { en: 'Keep these checked: they share causes with erection and hormone problems.', ar: 'حافظ على فحصها بانتظام لأنها تشترك في الأسباب مع مشكلات الانتصاب والهرمونات.' },
    source: 'Princeton III Consensus (2012)' } },

  // ---------- Infection ----------
  { id: 'IN-NOW', when: (a) => yes(a.utiNow), signal: { domain: 'infection', level: 'primary', modifiable: true,
    title: { en: 'Possible current genital or urinary infection', ar: 'احتمال وجود عدوى تناسلية أو بولية حالية' },
    why: { en: 'Get tested and treated soon, confidentially. Untreated infection can affect the sperm ducts.', ar: 'احرص على الفحص والعلاج قريباً بسرية. العدوى غير المعالجة قد تؤثر على القنوات المنوية.' },
    source: 'EAU Urological Infections 2024; WHO STI guidelines' } },
  { id: 'IN-HX', when: (a) => yes(a.infHx), signal: { domain: 'infection', level: 'selfcare', modifiable: false,
    title: { en: 'Past genital infection', ar: 'عدوى تناسلية سابقة' },
    why: { en: 'Usually no lasting effect. Mention it if you have a semen analysis.', ar: 'عادة لا يترك أثراً دائماً. اذكره عند إجراء تحليل السائل المنوي.' },
    source: 'AUA/ASRM 2020 (history)' } },

  // ---------- Exposures ----------
  { id: 'EX-TESTO', when: (a) => a.testosterone === 'current', signal: { domain: 'exposure', level: 'specialist', modifiable: true,
    title: { en: 'Current testosterone or steroid use', ar: 'استخدام حالي للتستوستيرون أو المنشطات' },
    why: { en: 'This switches off the testicles\' own sperm production, often to zero. Recovery is usually possible but can take months: get specialist advice before stopping.', ar: 'يوقف ذلك إنتاج الخصيتين للحيوانات المنوية وغالباً إلى الصفر. التعافي ممكن عادة لكنه قد يستغرق أشهراً، فاستشر أخصائياً قبل التوقف.' },
    source: 'AUA/ASRM 2020 Statement 30; AUA Testosterone 2018' } },
  { id: 'EX-TESTO-PAST', when: (a) => a.testosterone === 'past', signal: { domain: 'exposure', level: 'primary', modifiable: true,
    title: { en: 'Past testosterone or steroid use', ar: 'استخدام سابق للتستوستيرون أو المنشطات' },
    why: { en: 'Sperm production usually recovers in 6–18 months. A semen analysis confirms it.', ar: 'يتعافى الإنتاج عادة خلال ٦–١٨ شهراً، ويؤكد ذلك تحليل السائل المنوي.' },
    source: 'Liu et al., Lancet 2006 (recovery after hormonal suppression)' } },
  { id: 'EX-MEDS', when: (a) => ['finasteride', 'ssri', 'opioid', 'sulfasalazine'].some((m) => has(a.meds, m)), signal: { domain: 'exposure', level: 'primary', modifiable: true,
    title: { en: 'A medicine that can affect sperm or hormones', ar: 'دواء قد يؤثر على الحيوانات المنوية أو الهرمونات' },
    why: { en: 'Ask your doctor for a medicine review. There is often an alternative. Do not stop on your own.', ar: 'اطلب من طبيبك مراجعة أدويتك، فغالباً يوجد بديل. لا تتوقف من تلقاء نفسك.' },
    source: 'Semet et al., Hum Reprod Update 2017 (drugs & male fertility)' } },
  { id: 'EX-SMOKE', when: (a) => a.smoke === 'current', signal: { domain: 'exposure', level: 'selfcare', modifiable: true,
    title: { en: 'Current smoking, vaping or shisha', ar: 'تدخين أو شيشة أو سجائر إلكترونية حالياً' },
    why: { en: 'Smoking is linked to lower sperm count and motility. Free quit support can double your chances of stopping.', ar: 'يرتبط التدخين بانخفاض عدد الحيوانات المنوية وحركتها، والدعم المجاني للإقلاع يضاعف فرصك.' },
    source: 'Sharma et al., Eur Urol 2016 (meta-analysis, n≈6,000)' } },
  { id: 'EX-HEAT', when: (a) => ['outdoor', 'driving', 'sauna'].some((m) => has(a.heat, m)), signal: { domain: 'exposure', level: 'selfcare', modifiable: true,
    title: { en: 'Regular heat exposure to the groin', ar: 'تعرض متكرر للحرارة في منطقة الحوض' },
    why: { en: 'Sperm are made best a few degrees below body temperature. Breaks, loose clothing and shade help; effects are usually reversible.', ar: 'تُنتج الحيوانات المنوية بشكل أفضل في حرارة أقل من حرارة الجسم. الاستراحات والملابس الفضفاضة والظل تساعد، والتأثير غالباً قابل للعكس.' },
    source: 'Durairajanayagam et al., Reprod Biomed Online 2015' } },
  { id: 'EX-CHEM', when: (a) => yes(a.chem), signal: { domain: 'exposure', level: 'selfcare', modifiable: true,
    title: { en: 'Work exposure to chemicals', ar: 'تعرض مهني للمواد الكيميائية' },
    why: { en: 'Use the protective equipment provided and mention your job at any appointment.', ar: 'استخدم معدات الحماية واذكر طبيعة عملك في أي موعد.' },
    source: 'EAU SRH 2024 (environmental factors)' } },

  // ---------- Semen analysis (WHO 2021 lower reference limits) ----------
  { id: 'SA-AZOO', when: (a) => num(a.sConc) === 0, signal: { domain: 'semen', level: 'specialist', modifiable: false,
    title: { en: 'No sperm seen on the report', ar: 'لم تُرصد حيوانات منوية في التقرير' },
    why: { en: 'This needs a repeat test and a specialist. Many men with this result still have options, including sperm retrieval.', ar: 'يحتاج ذلك إلى تكرار الفحص ومراجعة أخصائي. لدى كثير من الرجال خيارات متاحة رغم ذلك، منها استخراج الحيوانات المنوية.' },
    source: 'AUA/ASRM 2020; WHO 2021' } },
  { id: 'SA-SEVERE', when: (a) => { const c = num(a.sConc); return c !== undefined && c > 0 && c < 5; }, signal: { domain: 'semen', level: 'specialist', modifiable: false,
    title: { en: 'Very low sperm concentration (under 5 million/mL)', ar: 'تركيز منخفض جداً (أقل من ٥ ملايين/مل)' },
    why: { en: 'Guidelines advise hormone tests and genetic testing at this level, with a specialist.', ar: 'توصي الإرشادات بفحوص هرمونية ووراثية عند هذا المستوى مع أخصائي.' },
    source: 'AUA/ASRM 2020 Statements 6 & 8' } },
  { id: 'SA-LOW', when: (a) => { const c = num(a.sConc); const v = num(a.sVol); const p = num(a.sProg); const m = num(a.sMorph);
      return (c !== undefined && c >= 5 && c < WHO_2021.concentration) || (v !== undefined && v < WHO_2021.volume) || (p !== undefined && p < WHO_2021.progressive) || (m !== undefined && m < WHO_2021.morphology); },
    signal: { domain: 'semen', level: 'fertility', modifiable: true,
    title: { en: 'One or more semen values below the WHO reference', ar: 'قيمة أو أكثر في تحليل السائل المنوي أقل من مرجع منظمة الصحة العالمية' },
    why: { en: 'One test is not a diagnosis: values vary a lot. Repeat after 2–3 months and review with a fertility clinic. Lifestyle changes can improve these numbers.', ar: 'فحص واحد ليس تشخيصاً لأن القيم تتفاوت كثيراً. أعد الفحص بعد ٢–٣ أشهر وراجعه مع عيادة خصوبة. تغييرات نمط الحياة قد تحسن النتائج.' },
    source: 'WHO Laboratory Manual 6th ed. 2021 (5th centile limits)' } },

  // ---------- Hormones ----------
  { id: 'HM-LOWT', when: (a) => { const t = num(a.tT); return t !== undefined && t < 12; }, signal: { domain: 'hormone', level: 'primary', modifiable: true,
    title: { en: 'Testosterone below 12 nmol/L', ar: 'التستوستيرون أقل من ١٢ نانومول/لتر' },
    why: { en: 'Needs a repeat early-morning test before any conclusion. Weight, sleep and blood sugar often explain it.', ar: 'يحتاج إلى إعادة الفحص صباحاً قبل أي استنتاج، وغالباً يفسره الوزن أو النوم أو السكر.' },
    source: 'EAU SRH 2024 (hypogonadism threshold)' } },
  { id: 'HM-FSH', when: (a) => { const f = num(a.fsh); return f !== undefined && f > 7.6; }, signal: { domain: 'hormone', level: 'specialist', modifiable: false,
    title: { en: 'Raised FSH', ar: 'ارتفاع هرمون FSH' },
    why: { en: 'Raised FSH can mean the testicles are working harder to make sperm. A specialist should interpret it with a semen analysis.', ar: 'قد يعني ارتفاع FSH أن الخصيتين تبذلان جهداً أكبر لإنتاج الحيوانات المنوية، ويجب أن يفسره أخصائي مع تحليل السائل المنوي.' },
    source: 'Schoor et al., Urology 2002; AUA/ASRM 2020' } },
];

// Questions whose answers matter for completeness scoring
const CORE = ['reason', 'age', 'hx', 'ed', 'ejac', 'height', 'weight', 'diabetes', 'utiNow', 'testosterone', 'meds', 'smoke', 'heat'];

export function derive(a: Answers): Derived {
  const h = num(a.height); const w = num(a.weight);
  const bmi = h && w ? Math.round((w / ((h / 100) ** 2)) * 10) / 10 : undefined;
  return { bmi, trying: a.reason === 'trying', months: num(a.tryingMonths), // v1.3: unknown partner age is treated conservatively (found by edge case E02)
    p35: a.partner35 === 'yes' || a.partner35 === 'unsure' || a.partner35 === 'skip' };
}

export function assess(a: Answers): Result {
  const d = derive(a);
  const trace: string[] = [];
  const signals: Signal[] = [];
  for (const r of RULES) {
    if (r.when(a, d)) { trace.push(r.id); signals.push({ id: r.id, ...r.signal }); }
  }
  let level: Level = 'selfcare';
  for (const s of signals) if (LEVEL_RANK[s.level] > LEVEL_RANK[level]) level = s.level;

  // Safety net: an unanswered or "not sure" red-flag question is never treated as "no".
  const unsureRF = ['rfAcutePain', 'rfPainFever', 'rfPriapism'].filter((k) => a[k] === 'unsure' || a[k] === undefined);
  if (unsureRF.length && LEVEL_RANK[level] < LEVEL_RANK.primary) {
    level = 'primary'; trace.push('SAFE-UNSURE-RF');
    signals.push({ id: 'SAFE-UNSURE-RF', domain: 'red-flag', level: 'primary', modifiable: false,
      title: { en: 'A safety question was left unsure', ar: 'تُرك سؤال سلامة دون إجابة مؤكدة' },
      why: { en: 'Because we could not rule out an urgent problem, we suggest speaking to a clinician rather than self-care alone. If pain is sudden or severe, go to emergency.', ar: 'لأننا لم نستبعد مشكلة عاجلة، ننصح بالتحدث إلى طبيب بدلاً من الرعاية الذاتية وحدها. إذا كان الألم مفاجئاً أو شديداً فتوجه إلى الطوارئ.' },
      source: 'Sanad safety policy: fail-safe on missing red-flag data' });
  }
  if (a.rfLump === 'unsure' && LEVEL_RANK[level] < LEVEL_RANK.primary) { level = 'primary'; trace.push('SAFE-UNSURE-LUMP'); }

  const answered = CORE.filter((k) => a[k] !== undefined && a[k] !== '' && a[k] !== 'skip').length;
  const redFlag = signals.some((s) => s.domain === 'red-flag' && s.level === 'urgent');
  signals.sort((x, y) => LEVEL_RANK[y.level] - LEVEL_RANK[x.level]);
  return { version: ENGINE_VERSION, level, signals, completeness: answered / CORE.length, bmi: d.bmi, redFlag, trace };
}

export const LEVELS: Record<Level, { title: T; when: T; next: T; color: string }> = {
  urgent: {
    title: { en: 'Urgent: go to emergency now', ar: 'عاجل: توجه إلى الطوارئ الآن' },
    when: { en: 'Today, now', ar: 'اليوم، الآن' },
    next: { en: 'Go to the nearest emergency department or call 998 (UAE ambulance). Do not wait for an appointment.', ar: 'توجه إلى أقرب قسم طوارئ أو اتصل بالرقم ٩٩٨ (الإسعاف في الإمارات). لا تنتظر موعداً.' },
    color: '#b42318',
  },
  specialist: {
    title: { en: 'See a urologist or andrologist', ar: 'راجع أخصائي المسالك أو الذكورة' },
    when: { en: 'Within 2–4 weeks (2 weeks for a lump)', ar: 'خلال ٢–٤ أسابيع (أسبوعان في حالة الكتلة)' },
    next: { en: 'Book a urology/andrology appointment. Your GP can refer you, or use the private teleconsult to get the referral.', ar: 'احجز موعداً لدى أخصائي المسالك/الذكورة. يمكن لطبيب الأسرة تحويلك، أو استخدم الاستشارة الخاصة عن بعد للحصول على التحويل.' },
    color: '#b54708',
  },
  fertility: {
    title: { en: 'Couple fertility assessment', ar: 'تقييم الخصوبة للزوجين' },
    when: { en: 'Within 1–2 months', ar: 'خلال ١–٢ شهر' },
    next: { en: 'Book a semen analysis and a fertility clinic visit for you both, together, not one after the other.', ar: 'احجز تحليل سائل منوي وزيارة عيادة خصوبة لكما معاً، وليس واحداً تلو الآخر.' },
    color: '#6941c6',
  },
  primary: {
    title: { en: 'Check-in with primary care', ar: 'مراجعة الرعاية الأولية' },
    when: { en: 'Within 4–6 weeks', ar: 'خلال ٤–٦ أسابيع' },
    next: { en: 'A GP or family-medicine visit (in person or teleconsult) for simple tests and a plan.', ar: 'زيارة طبيب الأسرة (حضورياً أو عن بعد) لفحوص بسيطة وخطة.' },
    color: '#026aa2',
  },
  selfcare: {
    title: { en: 'Self-care and re-check', ar: 'رعاية ذاتية وإعادة تقييم' },
    when: { en: 'Re-check in 6–12 months', ar: 'أعد التقييم بعد ٦–١٢ شهراً' },
    next: { en: 'No sign that you need an appointment now. Use the plan below. Come back sooner if anything changes.', ar: 'لا توجد علامة على حاجتك لموعد الآن. اتبع الخطة أدناه وعد أسرع إذا تغير شيء.' },
    color: '#067647',
  },
};
