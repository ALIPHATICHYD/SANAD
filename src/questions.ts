// Intake schema. Every question is optional except the safety screen,
// and every choice list includes a way to skip. The engine never needs
// nationality, religion, marital status or ethnicity, so we never ask.

export type Lang = 'en' | 'ar';
export type T = { en: string; ar: string };

export type Option = { v: string; l: T };
export type Question =
  | { id: string; kind: 'choice'; q: T; hint?: T; options: Option[]; showIf?: (a: Answers) => boolean }
  | { id: string; kind: 'multi'; q: T; hint?: T; options: Option[]; showIf?: (a: Answers) => boolean }
  | { id: string; kind: 'number'; q: T; hint?: T; unit?: string; min: number; max: number; step?: number; showIf?: (a: Answers) => boolean };

export type Step = { id: string; title: T; intro: T; questions: Question[] };
export type Answers = Record<string, string | number | string[] | undefined>;

const YN: Option[] = [
  { v: 'yes', l: { en: 'Yes', ar: 'نعم' } },
  { v: 'no', l: { en: 'No', ar: 'لا' } },
  { v: 'unsure', l: { en: 'Not sure', ar: 'لست متأكداً' } },
];
const YN_SKIP: Option[] = [...YN, { v: 'skip', l: { en: 'Prefer not to say', ar: 'أفضل عدم الإجابة' } }];

export const STEPS: Step[] = [
  {
    id: 'safety',
    title: { en: 'Safety first', ar: 'السلامة أولاً' },
    intro: {
      en: 'Four quick questions to make sure nothing needs urgent attention today.',
      ar: 'أربعة أسئلة سريعة للتأكد من عدم وجود ما يحتاج إلى رعاية عاجلة اليوم.',
    },
    questions: [
      { id: 'rfAcutePain', kind: 'choice', options: YN, q: { en: 'Sudden or severe pain in a testicle or the scrotum, now or in the last 24 hours?', ar: 'هل لديك ألم مفاجئ أو شديد في الخصية أو كيس الصفن الآن أو خلال آخر ٢٤ ساعة؟' } },
      { id: 'rfPainFever', kind: 'choice', options: YN, q: { en: 'Scrotal pain or swelling together with fever or redness?', ar: 'هل يوجد ألم أو تورم في كيس الصفن مع حرارة أو احمرار؟' } },
      { id: 'rfPriapism', kind: 'choice', options: YN, q: { en: 'An erection right now that has lasted more than 4 hours?', ar: 'هل لديك انتصاب مستمر الآن لأكثر من ٤ ساعات؟' } },
      { id: 'rfLump', kind: 'choice', options: YN, q: { en: 'A new lump, hard area, or change in the size or shape of a testicle?', ar: 'هل لاحظت كتلة جديدة أو منطقة صلبة أو تغيراً في حجم أو شكل الخصية؟' } },
    ],
  },
  {
    id: 'you',
    title: { en: 'About you', ar: 'عنك' },
    intro: { en: 'No name, email or ID. Skip anything you prefer not to answer.', ar: 'لا نطلب الاسم أو البريد أو الهوية. يمكنك تخطي أي سؤال.' },
    questions: [
      {
        id: 'reason', kind: 'choice', q: { en: 'What brings you here?', ar: 'ما سبب زيارتك؟' },
        options: [
          { v: 'trying', l: { en: 'We are trying to conceive', ar: 'نحاول الإنجاب حالياً' } },
          { v: 'planning', l: { en: 'Planning for the future', ar: 'أخطط للمستقبل' } },
          { v: 'checkup', l: { en: 'A general health check', ar: 'فحص صحي عام' } },
          { v: 'concern', l: { en: 'A specific concern', ar: 'قلق محدد' } },
          { v: 'skip', l: { en: 'Prefer not to say', ar: 'أفضل عدم الإجابة' } },
        ],
      },
      { id: 'age', kind: 'number', q: { en: 'Your age', ar: 'عمرك' }, unit: 'yrs', min: 18, max: 90 },
      { id: 'tryingMonths', kind: 'number', q: { en: 'How many months have you been trying?', ar: 'منذ كم شهراً تحاولان الإنجاب؟' }, unit: 'mo', min: 0, max: 240, showIf: (a) => a.reason === 'trying' },
      { id: 'partner35', kind: 'choice', options: YN_SKIP, q: { en: 'Is your wife or partner aged 35 or over?', ar: 'هل عمر زوجتك ٣٥ عاماً أو أكثر؟' }, hint: { en: 'Guidelines advise earlier assessment for both partners when she is 35+.', ar: 'توصي الإرشادات بتقييم مبكر للزوجين عندما يكون عمرها ٣٥ أو أكثر.' }, showIf: (a) => a.reason === 'trying' },
    ],
  },
  {
    id: 'history',
    title: { en: 'Medical history', ar: 'التاريخ الطبي' },
    intro: { en: 'Things from the past that can affect sperm production.', ar: 'أمور من الماضي قد تؤثر على إنتاج الحيوانات المنوية.' },
    questions: [
      {
        id: 'hx', kind: 'multi', q: { en: 'Have you ever had any of these?', ar: 'هل سبق أن أصبت بأي مما يلي؟' },
        options: [
          { v: 'undescended', l: { en: 'Undescended testicle as a child', ar: 'خصية معلقة في الطفولة' } },
          { v: 'mumps', l: { en: 'Mumps with testicular swelling after puberty', ar: 'نكاف مع تورم الخصية بعد البلوغ' } },
          { v: 'trauma', l: { en: 'Testicular injury, torsion or surgery', ar: 'إصابة أو التواء أو جراحة في الخصية' } },
          { v: 'hernia', l: { en: 'Groin hernia repair', ar: 'إصلاح فتق إربي' } },
          { v: 'vasectomy', l: { en: 'Vasectomy', ar: 'قطع القناة الدافقة' } },
          { v: 'cancerTx', l: { en: 'Chemotherapy or radiotherapy', ar: 'علاج كيميائي أو إشعاعي' } },
          { v: 'varicocele', l: { en: 'Varicocele (told by a doctor, or "bag of worms" feeling)', ar: 'دوالي الخصية' } },
          { v: 'genetic', l: { en: 'A known genetic condition (e.g. cystic fibrosis, Klinefelter)', ar: 'حالة وراثية معروفة (مثل التليف الكيسي أو متلازمة كلاينفلتر)' } },
          { v: 'none', l: { en: 'None of these', ar: 'لا شيء مما سبق' } },
        ],
      },
    ],
  },
  {
    id: 'function',
    title: { en: 'Sexual health', ar: 'الصحة الجنسية' },
    intro: { en: 'Common, treatable, and often linked to heart and hormone health.', ar: 'أمور شائعة وقابلة للعلاج، وغالباً ما ترتبط بصحة القلب والهرمونات.' },
    questions: [
      { id: 'ed', kind: 'choice', q: { en: 'Difficulty getting or keeping an erection?', ar: 'هل تجد صعوبة في الانتصاب أو المحافظة عليه؟' }, options: [
        { v: 'never', l: { en: 'Rarely or never', ar: 'نادراً أو أبداً' } },
        { v: 'sometimes', l: { en: 'Sometimes', ar: 'أحياناً' } },
        { v: 'often', l: { en: 'Often', ar: 'غالباً' } },
        { v: 'skip', l: { en: 'Prefer not to say', ar: 'أفضل عدم الإجابة' } },
      ] },
      { id: 'ejac', kind: 'choice', q: { en: 'Any problem with ejaculation?', ar: 'هل توجد مشكلة في القذف؟' }, options: [
        { v: 'none', l: { en: 'No', ar: 'لا' } },
        { v: 'absent', l: { en: 'Absent, very little, or delayed', ar: 'غائب أو قليل جداً أو متأخر' } },
        { v: 'early', l: { en: 'Too early', ar: 'مبكر' } },
        { v: 'skip', l: { en: 'Prefer not to say', ar: 'أفضل عدم الإجابة' } },
      ] },
      { id: 'lowT', kind: 'choice', options: YN_SKIP, q: { en: 'Low sex drive together with tiredness or low mood for months?', ar: 'هل تعاني من ضعف الرغبة مع تعب أو مزاج منخفض لعدة أشهر؟' } },
    ],
  },
  {
    id: 'metabolic',
    title: { en: 'Body and metabolism', ar: 'الجسم والأيض' },
    intro: { en: 'Weight, sugar and blood pressure all affect hormones and sperm.', ar: 'الوزن والسكر وضغط الدم كلها تؤثر على الهرمونات والحيوانات المنوية.' },
    questions: [
      { id: 'height', kind: 'number', q: { en: 'Height', ar: 'الطول' }, unit: 'cm', min: 120, max: 230 },
      { id: 'weight', kind: 'number', q: { en: 'Weight', ar: 'الوزن' }, unit: 'kg', min: 35, max: 300 },
      { id: 'diabetes', kind: 'choice', q: { en: 'Diabetes?', ar: 'هل لديك سكري؟' }, options: [
        { v: 'no', l: { en: 'No', ar: 'لا' } },
        { v: 'controlled', l: { en: 'Yes, well controlled', ar: 'نعم، ومسيطر عليه' } },
        { v: 'uncontrolled', l: { en: 'Yes, not well controlled', ar: 'نعم، وغير مسيطر عليه' } },
        { v: 'unknown', l: { en: 'Never been tested', ar: 'لم أفحص أبداً' } },
      ] },
      { id: 'bp', kind: 'choice', options: YN, q: { en: 'High blood pressure or high cholesterol?', ar: 'هل لديك ضغط دم مرتفع أو كوليسترول مرتفع؟' } },
    ],
  },
  {
    id: 'infection',
    title: { en: 'Infections', ar: 'العدوى' },
    intro: { en: 'Some infections quietly affect fertility and are easy to treat.', ar: 'بعض أنواع العدوى تؤثر على الخصوبة بصمت ويسهل علاجها.' },
    questions: [
      { id: 'utiNow', kind: 'choice', options: YN_SKIP, q: { en: 'Burning when passing urine, or discharge, right now?', ar: 'هل لديك حرقة أثناء التبول أو إفرازات حالياً؟' } },
      { id: 'infHx', kind: 'choice', options: YN_SKIP, q: { en: 'Ever treated for a genital or testicular infection (e.g. epididymitis)?', ar: 'هل سبق أن عولجت من عدوى تناسلية أو التهاب في الخصية أو البربخ؟' } },
    ],
  },
  {
    id: 'exposures',
    title: { en: 'Medicines and lifestyle', ar: 'الأدوية ونمط الحياة' },
    intro: { en: 'Many of these are fully reversible. Never stop a prescribed medicine without your doctor.', ar: 'كثير من هذه العوامل قابلة للتغيير. لا توقف أي دواء موصوف دون استشارة طبيبك.' },
    questions: [
      { id: 'testosterone', kind: 'choice', q: { en: 'Testosterone, anabolic steroids or "gym" hormones?', ar: 'هل تستخدم التستوستيرون أو المنشطات أو هرمونات كمال الأجسام؟' }, options: [
        { v: 'never', l: { en: 'Never', ar: 'أبداً' } },
        { v: 'past', l: { en: 'In the past', ar: 'في الماضي' } },
        { v: 'current', l: { en: 'Currently', ar: 'حالياً' } },
        { v: 'skip', l: { en: 'Prefer not to say', ar: 'أفضل عدم الإجابة' } },
      ] },
      { id: 'meds', kind: 'multi', q: { en: 'Do you take any of these medicines?', ar: 'هل تتناول أياً من هذه الأدوية؟' }, options: [
        { v: 'finasteride', l: { en: 'Finasteride or dutasteride (hair loss / prostate)', ar: 'فيناسترايد أو دوتاسترايد (تساقط الشعر/البروستاتا)' } },
        { v: 'ssri', l: { en: 'Antidepressants (SSRIs)', ar: 'مضادات الاكتئاب' } },
        { v: 'opioid', l: { en: 'Opioid pain medicines', ar: 'مسكنات أفيونية' } },
        { v: 'sulfasalazine', l: { en: 'Sulfasalazine or methotrexate', ar: 'سلفاسالازين أو ميثوتريكسات' } },
        { v: 'none', l: { en: 'None of these', ar: 'لا شيء' } },
      ] },
      { id: 'smoke', kind: 'choice', q: { en: 'Cigarettes, vape, shisha or midwakh?', ar: 'السجائر أو السجائر الإلكترونية أو الشيشة أو المدواخ؟' }, options: [
        { v: 'never', l: { en: 'Never', ar: 'أبداً' } },
        { v: 'past', l: { en: 'Stopped', ar: 'توقفت' } },
        { v: 'current', l: { en: 'Currently', ar: 'حالياً' } },
        { v: 'skip', l: { en: 'Prefer not to say', ar: 'أفضل عدم الإجابة' } },
      ] },
      { id: 'heat', kind: 'multi', q: { en: 'Regular heat around the groin?', ar: 'هل تتعرض لحرارة متكررة في منطقة الحوض؟' }, options: [
        { v: 'outdoor', l: { en: 'Outdoor work in hot weather', ar: 'عمل خارجي في الطقس الحار' } },
        { v: 'driving', l: { en: 'Driving more than 3 hours a day', ar: 'القيادة أكثر من ٣ ساعات يومياً' } },
        { v: 'sauna', l: { en: 'Sauna, hot tub or laptop on lap', ar: 'ساونا أو حوض ساخن أو حاسوب على الحضن' } },
        { v: 'none', l: { en: 'None', ar: 'لا شيء' } },
      ] },
      { id: 'chem', kind: 'choice', options: YN_SKIP, q: { en: 'Work with pesticides, solvents, paints or metals?', ar: 'هل تعمل مع المبيدات أو المذيبات أو الدهانات أو المعادن؟' } },
    ],
  },
  {
    id: 'tests',
    title: { en: 'Results you already have', ar: 'نتائج لديك مسبقاً' },
    intro: { en: 'Optional. Enter only what is on your report; leave the rest blank.', ar: 'اختياري. أدخل فقط ما في تقريرك واترك الباقي فارغاً.' },
    questions: [
      { id: 'sConc', kind: 'number', q: { en: 'Sperm concentration', ar: 'تركيز الحيوانات المنوية' }, unit: 'M/mL', min: 0, max: 400, step: 0.1 },
      { id: 'sVol', kind: 'number', q: { en: 'Semen volume', ar: 'حجم السائل المنوي' }, unit: 'mL', min: 0, max: 15, step: 0.1 },
      { id: 'sProg', kind: 'number', q: { en: 'Progressive motility', ar: 'الحركة التقدمية' }, unit: '%', min: 0, max: 100 },
      { id: 'sMorph', kind: 'number', q: { en: 'Normal forms (morphology)', ar: 'الأشكال الطبيعية' }, unit: '%', min: 0, max: 100, step: 0.5 },
      { id: 'tT', kind: 'number', q: { en: 'Morning total testosterone', ar: 'التستوستيرون الكلي الصباحي' }, unit: 'nmol/L', min: 0, max: 60, step: 0.1 },
      { id: 'fsh', kind: 'number', q: { en: 'FSH', ar: 'الهرمون المنبه للجريب FSH' }, unit: 'IU/L', min: 0, max: 100, step: 0.1 },
    ],
  },
  {
    id: 'prefs',
    title: { en: 'How you want care', ar: 'كيف تفضل الرعاية' },
    intro: { en: 'We use this only to suggest the right kind of appointment.', ar: 'نستخدم هذا فقط لاقتراح نوع الموعد المناسب.' },
    questions: [
      { id: 'mode', kind: 'choice', q: { en: 'First step you are comfortable with', ar: 'الخطوة الأولى التي تناسبك' }, options: [
        { v: 'tele', l: { en: 'Private teleconsultation', ar: 'استشارة عن بعد خاصة' } },
        { v: 'visit', l: { en: 'In-person visit', ar: 'زيارة حضورية' } },
        { v: 'home', l: { en: 'Start with an at-home step', ar: 'البدء بخطوة منزلية' } },
      ] },
      { id: 'clinGender', kind: 'choice', q: { en: 'Clinician preference', ar: 'تفضيل الطبيب' }, options: [
        { v: 'male', l: { en: 'Male clinician', ar: 'طبيب رجل' } },
        { v: 'any', l: { en: 'No preference', ar: 'لا يهم' } },
      ] },
    ],
  },
];
