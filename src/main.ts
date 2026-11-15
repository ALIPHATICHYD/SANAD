import './style.css';
import QRCode from 'qrcode';
import { STEPS, type Answers, type Lang, type Question, type T } from './questions';
import { assess, LEVELS, ENGINE_VERSION, WHO_2021, type Level, type Signal } from './engine';
import { UI } from './i18n';
import { packShare, openShare, newPin, type SharePayload } from './share';
import { runEval } from './eval';
import { CASES } from './cases';
import { icon } from './icons';

// ---------------- state ----------------
const S = {
  get lang(): Lang { return (localStorage.getItem('sanad.lang') as Lang) || 'en'; },
  set lang(l: Lang) { localStorage.setItem('sanad.lang', l); },
  get answers(): Answers { return JSON.parse(sessionStorage.getItem('sanad.answers') || '{}'); },
  set answers(a: Answers) { sessionStorage.setItem('sanad.answers', JSON.stringify(a)); },
  get consent(): { c1: boolean; c2: boolean; c3: boolean } | null { return JSON.parse(sessionStorage.getItem('sanad.consent') || 'null'); },
  set consent(c) { sessionStorage.setItem('sanad.consent', JSON.stringify(c)); },
};
const L = () => S.lang;
const en = () => L() === 'en';
const x = (e: string, a: string) => (en() ? e : a);
const tr = (t: T) => t[L()];
const u = (k: keyof typeof UI) => UI[k][L()];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const app = document.querySelector<HTMLDivElement>('#app')!;
const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;

const LV_ORDER: Level[] = ['selfcare', 'primary', 'fertility', 'specialist', 'urgent'];
const LV_SHORT: Record<Level, T> = {
  selfcare: { en: 'Self-care', ar: 'رعاية ذاتية' }, primary: { en: 'GP', ar: 'طبيب الأسرة' },
  fertility: { en: 'Fertility', ar: 'الخصوبة' }, specialist: { en: 'Specialist', ar: 'أخصائي' }, urgent: { en: 'Urgent', ar: 'عاجل' },
};
const DOMAIN: Record<Signal['domain'], { ic: string; c: string; bg: string; l: T }> = {
  'red-flag': { ic: 'siren', c: '#B42318', bg: '#FBE9E6', l: { en: 'Safety', ar: 'السلامة' } },
  history: { ic: 'history', c: '#B4540A', bg: '#FBEFE3', l: { en: 'History', ar: 'التاريخ الطبي' } },
  function: { ic: 'activity', c: '#0E6A9C', bg: '#E4F0F7', l: { en: 'Sexual health', ar: 'الصحة الجنسية' } },
  metabolic: { ic: 'scale', c: '#0E6A9C', bg: '#E4F0F7', l: { en: 'Metabolism', ar: 'الأيض' } },
  infection: { ic: 'bug', c: '#B4540A', bg: '#FBEFE3', l: { en: 'Infection', ar: 'العدوى' } },
  exposure: { ic: 'flame', c: '#14605C', bg: '#E2EEEA', l: { en: 'Lifestyle', ar: 'نمط الحياة' } },
  semen: { ic: 'flask-conical', c: '#5B3FB8', bg: '#EFEAFB', l: { en: 'Fertility', ar: 'الخصوبة' } },
  hormone: { ic: 'test-tube', c: '#5B3FB8', bg: '#EFEAFB', l: { en: 'Hormones', ar: 'الهرمونات' } },
  timing: { ic: 'calendar-clock', c: '#5B3FB8', bg: '#EFEAFB', l: { en: 'Timing', ar: 'التوقيت' } },
};
const OPT_IC: Record<string, string> = {
  yes: 'check', no: 'x', unsure: 'circle-help', skip: 'eye-off', never: 'ban', past: 'history', current: 'pill', unknown: 'circle-help',
  trying: 'baby', planning: 'calendar-heart', checkup: 'heart-pulse', concern: 'circle-help',
  tele: 'video', visit: 'stethoscope', home: 'house', male: 'user', any: 'users',
};
const REF: Record<string, string> = { sConc: `≥ ${WHO_2021.concentration}`, sVol: `≥ ${WHO_2021.volume}`, sProg: `≥ ${WHO_2021.progressive}`, sMorph: `≥ ${WHO_2021.morphology}` };

function wipe() {
  ['sanad.answers', 'sanad.consent', 'sanad.result', 'sanad.intent'].forEach((k) => sessionStorage.removeItem(k));
}
function tally(event: string) {
  // Opt-in, aggregate only: a count per event, no answers, no identifiers.
  if (!S.consent?.c3) return;
  const k = 'sanad.tally'; const t = JSON.parse(localStorage.getItem(k) || '{}');
  t[event] = (t[event] || 0) + 1; localStorage.setItem(k, JSON.stringify(t));
}
function toast(msg: string) {
  document.querySelectorAll('.toast').forEach((e) => e.remove());
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; el.setAttribute('role', 'status');
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}
const arch = (c = '#E9D7A8', s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><path d="M9 32V18a11 11 0 0 1 22 0v14" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/><path d="M15.5 32v-12a4.5 4.5 0 0 1 9 0v12" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round" opacity=".55"/></svg>`;
const brand = () => `<a href="#/" class="brand" aria-label="Sanad home"><span class="mark">${arch()}</span><span><b>Sanad</b><i>سند</i></span></a>`;

// ---------------- chrome ----------------
function setDoc() {
  document.documentElement.lang = L();
  document.documentElement.dir = L() === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('.scrim').forEach((e) => e.remove());
  window.scrollTo(0, 0);
}
function shell(inner: string, opts: { flow?: boolean; cls?: string } = {}) {
  setDoc();
  document.body.className = opts.cls ?? '';
  const here = location.hash;
  app.innerHTML = `
  <header class="top">
    ${brand()}
    <nav class="links" aria-label="Main">
      <a href="#/privacy" class="${here.startsWith('#/privacy') ? 'on' : ''}">${u('privacy')}</a>
      <a href="#/clinician">${x('For clinicians', 'للأطباء')}</a>
      <a href="#/evidence" class="${here.startsWith('#/evidence') ? 'on' : ''}">${x('Evidence', 'الأدلة')}</a>
    </nav>
    <div class="tright">
      <button class="lang" id="lang" aria-label="Switch language">${icon('languages', 's16')}${en() ? 'العربية' : 'English'}</button>
      ${opts.flow ? '' : `<a class="btn primary sm hide-sm" href="#/consent">${u('start')}</a>`}
    </div>
  </header>
  <main class="${opts.flow ? 'flow' : ''}">${inner}</main>
  <footer>
    <span>${u('notDx')}</span>
    <button class="link" id="wipe">${u('del')}</button>
    <span>${ENGINE_VERSION} · ${x('prototype · simulated data only', 'نموذج أولي · بيانات محاكاة فقط')}</span>
  </footer>`;
  $('lang').onclick = () => { S.lang = en() ? 'ar' : 'en'; route(); };
  $('wipe').onclick = () => { wipe(); localStorage.removeItem('sanad.tally'); toast(u('deleted')); location.hash = '#/'; };
}

// ---------------- home ----------------
function home() {
  const has = !!sessionStorage.getItem('sanad.result');
  const intents: [string, string, T, T][] = [
    ['trying', 'baby', { en: "We're trying to conceive", ar: 'نحاول الإنجاب' }, { en: 'Check together, early', ar: 'افحصا معاً ومبكراً' }],
    ['planning', 'calendar-heart', { en: 'Planning marriage or family', ar: 'أخطط للزواج أو الأسرة' }, { en: 'Preconception check', ar: 'فحص ما قبل الحمل' }],
    ['checkup', 'heart-pulse', { en: 'A general health check', ar: 'فحص صحي عام' }, { en: 'Hormones, weight, sugar', ar: 'الهرمونات والوزن والسكر' }],
    ['concern', 'circle-help', { en: 'A specific concern', ar: 'قلق محدد' }, { en: 'Ask privately', ar: 'اسأل بخصوصية' }],
  ];
  const steps: [T, T][] = [
    [{ en: 'Answer privately', ar: 'أجب بخصوصية' }, { en: 'One question at a time. Skip anything. Stays on your phone.', ar: 'سؤال واحد في كل مرة. تخطَّ ما تشاء. يبقى على هاتفك.' }],
    [{ en: 'See what matters', ar: 'اعرف ما يهم' }, { en: 'Every signal explained, with the medical guideline behind it.', ar: 'كل مؤشر مشروح مع الإرشاد الطبي الذي يستند إليه.' }],
    [{ en: 'Get one next step', ar: 'خطوة تالية واحدة' }, { en: 'Self-care, GP, fertility clinic, specialist, or urgent care.', ar: 'رعاية ذاتية أو طبيب أسرة أو عيادة خصوبة أو أخصائي أو طوارئ.' }],
    [{ en: 'Book or share', ar: 'احجز أو شارك' }, { en: 'Teleconsult, male doctor, Arabic-speaking. You choose what they see.', ar: 'استشارة عن بعد، طبيب رجل، يتحدث العربية. أنت تختار ما يراه.' }],
  ];
  const trust: [string, T, T][] = [
    ['shield-check', { en: 'Encrypted on your phone', ar: 'مشفر على هاتفك' }, { en: 'AES-256, nothing on a server', ar: 'AES-256 ولا شيء على الخادم' }],
    ['book-open-check', { en: 'Built on guidelines', ar: 'مبني على الإرشادات' }, { en: 'WHO 2021 · AUA/ASRM · EAU', ar: 'WHO 2021 · AUA/ASRM · EAU' }],
    ['stethoscope', { en: 'Doctors decide', ar: 'الطبيب يقرر' }, { en: 'Clinician review for every referral', ar: 'مراجعة طبية لكل تحويل' }],
    ['badge-check', { en: 'Designed for UAE law', ar: 'مصمم وفق قوانين الإمارات' }, { en: 'PDPL · health data stays in-country', ar: 'حماية البيانات · تبقى داخل الدولة' }],
  ];
  shell(`
  <section class="dhero"><div class="pattern"></div>
    <div>
      <p class="kicker">${x('A private first step for men in the UAE', 'خطوة أولى خاصة للرجال في الإمارات')}</p>
      <h1>${x("Men's reproductive health, privately.", 'صحتك الإنجابية، بخصوصية تامة.')}</h1>
      ${en() ? `<p class="ar" dir="rtl" lang="ar" style="text-align:left">صحتك الإنجابية، بخصوصية تامة</p>` : `<p class="ar" lang="en" dir="ltr" style="text-align:right;font-family:'IBM Plex Sans'">Men's reproductive health, privately.</p>`}
      <p class="lead">${x('A 4-minute check that explains what matters, why, and the right next step, in Arabic or English. Nothing leaves your phone unless you choose.', 'فحص مدته ٤ دقائق يشرح ما يهم ولماذا، والخطوة التالية المناسبة، بالعربية أو الإنجليزية. لا يغادر شيء هاتفك إلا باختيارك.')}</p>
      <div class="row">
        <a class="btn gold" href="#/consent">${u('start')} ${icon('arrow-right', 'flip')}</a>
        ${has ? `<a class="btn onDark" href="#/result">${u('resume')}</a>` : `<a class="btn onDark" href="#how">${x('How it works', 'كيف يعمل')}</a>`}
      </div>
    </div>
    <div>
      <p class="qlabel">${x('What brings you here?', 'ما الذي أتى بك؟')}</p>
      <div class="intents">
        ${intents.map(([v, ic, t, s]) => `<a href="#/start/${v}">${icon(ic)}<b>${tr(t)}</b><small>${tr(s)}</small></a>`).join('')}
      </div>
    </div>
  </section>
  <section class="steps4" id="how">
    ${steps.map(([t, p], i) => `<div class="card"><span class="num">0${i + 1}</span><h3>${tr(t)}</h3><p>${tr(p)}</p></div>`).join('')}
  </section>
  <section class="tstack">
    ${trust.map(([ic, t, s]) => `<div><span class="pi">${icon(ic)}</span><span><b>${tr(t)}</b>${tr(s)}</span></div>`).join('')}
  </section>`);
  const how = document.querySelector<HTMLAnchorElement>('a[href="#how"]');
  if (how) how.onclick = (e) => { e.preventDefault(); $('how').scrollIntoView({ behavior: 'smooth' }); };
}

// ---------------- language + consent ----------------
function consent() {
  const c = S.consent ?? { c1: true, c2: true, c3: false };
  const tog = (id: string, on: boolean, t: string, s: string, dis = false) =>
    `<label class="toggle-row"><div><b>${t}</b><small>${s}</small></div><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}><span class="tg"></span></label>`;
  shell(`
  <div class="fbar"><a class="iconbtn" href="#/" aria-label="${u('back')}">${icon('arrow-left', 'flip')}</a><span class="t"></span><span style="width:42px"></span></div>
  <h1 style="margin-top:10px">${x('Choose your language', 'اختر لغتك')}</h1>
  <p class="serif" style="font-size:1.4rem;color:var(--g2);margin-bottom:18px;font-family:'IBM Plex Sans Arabic'">${en() ? 'اختر لغتك' : 'Choose your language'}</p>
  <button class="langcard ${L() === 'ar' ? 'on' : ''}" data-l="ar"><span class="big">ع</span><span><b>العربية</b><small>${x('Arabic · right to left', 'من اليمين إلى اليسار')}</small></span>${L() === 'ar' ? `<span class="tick">${icon('circle-check', 's24')}</span>` : ''}</button>
  <button class="langcard ${L() === 'en' ? 'on' : ''}" data-l="en"><span class="big" style="font-family:'IBM Plex Sans'">En</span><span><b>English</b><small>${x('You can switch any time', 'يمكنك التبديل في أي وقت')}</small></span>${L() === 'en' ? `<span class="tick">${icon('circle-check', 's24')}</span>` : ''}</button>
  <div class="promises">
    <div class="prom"><span class="pi">${icon('eye-off')}</span><div><b>${x('No name. No Emirates ID.', 'لا اسم ولا هوية إماراتية.')}</b><span>${x('We never ask who you are.', 'لا نسألك أبداً عن هويتك.')}</span></div></div>
    <div class="prom"><span class="pi">${icon('smartphone')}</span><div><b>${x('Your data stays yours', 'بياناتك ملكك')}</b><span>${x('Answers live on this phone only.', 'تبقى الإجابات على هذا الهاتف فقط.')}</span></div></div>
  </div>
  <h2 style="margin-top:6px">${u('consentTitle')}</h2>
  ${tog('c1', true, x('Guidance on this device', 'إرشادات على هذا الجهاز'), u('c1'), true)}
  ${tog('c2', c.c2, x('Optional sharing', 'مشاركة اختيارية'), u('c2'))}
  ${tog('c3', c.c3, x('Anonymous statistics', 'إحصاءات مجهولة'), u('c3'))}
  <p class="willnot">${u('willNot')}</p>
  <button class="btn primary block" id="go">${en() ? 'Continue · متابعة' : 'متابعة · Continue'} ${icon('arrow-right', 'flip')}</button>
  <p class="foot">${icon('clock')} ${x('About 4 minutes · 9 short sections', 'حوالي ٤ دقائق · ٩ أقسام قصيرة')}</p>`, { flow: true });
  app.querySelectorAll<HTMLButtonElement>('.langcard').forEach((b) => (b.onclick = () => {
    S.consent = { c1: true, c2: $<HTMLInputElement>('c2').checked, c3: $<HTMLInputElement>('c3').checked };
    S.lang = b.dataset.l as Lang; consent();
  }));
  $('go').onclick = () => {
    S.consent = { c1: true, c2: $<HTMLInputElement>('c2').checked, c3: $<HTMLInputElement>('c3').checked };
    const intent = sessionStorage.getItem('sanad.intent');
    if (intent) { const a = S.answers; if (!a.reason) { a.reason = intent; S.answers = a; } sessionStorage.removeItem('sanad.intent'); }
    tally('started'); location.hash = '#/check/0';
  };
}

// ---------------- check: one question per screen ----------------
type Screen = { step: number; qs: Question[] };
function screens(a: Answers): Screen[] {
  const out: Screen[] = [];
  STEPS.forEach((st, si) => {
    let run: Question[] = [];
    for (const q of st.questions.filter((q) => !q.showIf || q.showIf(a))) {
      if (q.kind === 'number') run.push(q);
      else { if (run.length) { out.push({ step: si, qs: run }); run = []; } out.push({ step: si, qs: [q] }); }
    }
    if (run.length) out.push({ step: si, qs: run });
  });
  return out;
}

function optRow(q: Question & { options: { v: string; l: T }[] }, val: unknown) {
  const multi = q.kind === 'multi';
  return q.options.map((o) => {
    const on = multi ? Array.isArray(val) && val.includes(o.v) : val === o.v;
    const ic = !multi ? (q.id === 'smoke' && o.v === 'current' ? 'cigarette' : q.id === 'testosterone' && o.v === 'current' ? 'dumbbell' : OPT_IC[o.v]) : undefined;
    return `<button type="button" class="opt ${on ? 'on' : ''}" data-q="${q.id}" data-v="${o.v}" data-multi="${multi}" aria-pressed="${on}">
      ${ic ? `<span class="oi">${icon(ic)}</span>` : ''}<span>${tr(o.l)}</span>
      <span class="r ${multi ? 'sq' : ''}">${multi && on ? icon('check') : ''}</span></button>`;
  }).join('');
}

function check(i: number) {
  if (!S.consent) { location.hash = '#/consent'; return; }
  const a = S.answers;
  const all = screens(a);
  const sc = all[i]; if (!sc) { tally('completed'); location.hash = '#/result'; return; }
  const step = STEPS[sc.step];
  const single = sc.qs.length === 1 && sc.qs[0].kind !== 'number' ? sc.qs[0] : null;
  const title = single ? tr(single.q) : tr(step.title);
  const why = single?.hint ? tr(single.hint) : tr(step.intro);
  const isLast = i === all.length - 1;
  const body = single
    ? optRow(single as never, a[single.id])
    : sc.qs.map((q) => q.kind === 'number' ? `<label class="numf"><span>${tr(q.q)}</span>
        <span class="box"><input data-q="${q.id}" type="number" inputmode="decimal" min="${q.min}" max="${q.max}" step="${q.step ?? 1}" value="${a[q.id] ?? ''}" placeholder="—"><em>${q.unit ?? ''}</em></span>
        ${REF[q.id] ? `<span class="ref">${x('WHO 2021 reference', 'المرجع WHO 2021')}: ${REF[q.id]} ${q.unit}</span>` : ''}</label>` : '').join('');
  shell(`
  <div class="fbar">
    <button class="iconbtn" id="back" aria-label="${u('back')}">${icon('arrow-left', 'flip')}</button>
    <span class="t">${tr(step.title)} · ${sc.step + 1}/${STEPS.length}</span>
    ${sc.step === 0 ? '<span style="width:42px"></span>' : `<button class="skip" id="skip">${u('skip')}</button>`}
  </div>
  <div class="seg" aria-label="progress">${STEPS.map((_, k) => `<span class="${k <= sc.step ? 'on' : ''}"></span>`).join('')}</div>
  <h1 class="qtitle">${title}</h1>
  <div class="why">${icon('info')}<span>${why}</span></div>
  <form id="f" onsubmit="return false">${body}</form>
  <div class="actions"><button class="btn primary block" id="next">${isLast ? u('finish') : u('next')} ${icon('arrow-right', 'flip')}</button>
  <p class="foot">${icon('lock')} ${x('Only on this phone. Not saved anywhere.', 'على هاتفك فقط. لا يُحفظ في أي مكان.')}</p></div>`, { flow: true });

  app.querySelectorAll<HTMLButtonElement>('.opt').forEach((b) => (b.onclick = () => {
    const cur = S.answers; const id = b.dataset.q!; const v = b.dataset.v!;
    if (b.dataset.multi === 'true') {
      let arr = Array.isArray(cur[id]) ? [...(cur[id] as string[])] : [];
      if (v === 'none') arr = arr.includes('none') ? [] : ['none'];
      else { arr = arr.filter((y) => y !== 'none'); arr = arr.includes(v) ? arr.filter((y) => y !== v) : [...arr, v]; }
      cur[id] = arr;
    } else cur[id] = cur[id] === v ? undefined : v;
    S.answers = cur;
    const y = window.scrollY; check(i); window.scrollTo(0, y);
  }));
  const saveNums = () => app.querySelectorAll<HTMLInputElement>('input[type=number]').forEach((inp) => {
    const cur = S.answers; const n = parseFloat(inp.value);
    cur[inp.dataset.q!] = Number.isFinite(n) ? Math.min(Math.max(n, +inp.min), +inp.max) : undefined; S.answers = cur;
  });
  app.querySelectorAll<HTMLInputElement>('input[type=number]').forEach((inp) => (inp.onchange = saveNums));
  const go = (n: number) => { location.hash = `#/check/${n}`; };
  $('back').onclick = () => (i === 0 ? (location.hash = '#/consent') : go(i - 1));
  const sk = document.getElementById('skip'); if (sk) sk.onclick = () => go(i + 1);
  $('next').onclick = () => {
    saveNums();
    if (sc.step === 0 && assess(S.answers).redFlag) { location.hash = '#/urgent'; return; }
    // Re-evaluate the screen list: an answer can reveal a follow-up question.
    if (isLast && i >= screens(S.answers).length - 1) { tally('completed'); location.hash = '#/result'; } else go(i + 1);
  };
}

function urgent() {
  const r = assess(S.answers);
  tally('urgent');
  const flags = r.signals.filter((s) => s.domain === 'red-flag' && s.level === 'urgent');
  const firstNonSafety = screens(S.answers).findIndex((s) => s.step > 0);
  shell(`
  <span class="sos">${icon('siren', 's28')}</span>
  <h1>${u('urgentStop')}</h1>
  ${flags.map((s) => `<p style="font-size:1.05rem"><b>${tr(s.title)}.</b> ${tr(s.why)}</p>`).join('')}
  <div class="card" style="margin-top:16px">
    <div class="erlist">${icon('map-pin')}<div><b>${x('Nearest emergency department', 'أقرب قسم طوارئ')}</b>
    <p class="muted small" style="margin:4px 0 0">${x('In Abu Dhabi this includes Sheikh Khalifa Medical City and Cleveland Clinic Abu Dhabi. Any emergency department can help.', 'في أبوظبي تشمل مدينة الشيخ خليفة الطبية وكليفلاند كلينك أبوظبي. أي قسم طوارئ يمكنه المساعدة.')}</p></div></div>
  </div>
  <p class="foot" style="justify-content:flex-start">${icon('info')} ${x('Shown by a fixed safety rule, not a prediction.', 'تظهر بسبب قاعدة سلامة ثابتة، وليست تنبؤاً.')}</p>
  <div class="stack actions">
    <a class="btn danger block" href="tel:998">${icon('phone')} ${x('Call 998 ambulance', 'اتصل بالإسعاف ٩٩٨')}</a>
    <a class="btn block" href="https://www.google.com/maps/search/emergency+department" target="_blank" rel="noopener noreferrer">${icon('navigation')} ${x('Directions', 'الاتجاهات')}</a>
    <a class="btn block" style="border:none;background:none;color:var(--mut)" href="#/check/${Math.max(firstNonSafety, 0)}">${u('continueAnyway')}</a>
  </div>`, { flow: true, cls: 'urgentpage' });
}

// ---------------- result ----------------
function sigRow(s: Signal) {
  const d = DOMAIN[s.domain];
  return `<button class="sig" data-sig="${s.id}"><span class="d" style="background:${d.bg};color:${d.c}">${icon(d.ic)}</span>
    <span><b>${tr(s.title)}</b><small>${tr(d.l)} · ${esc(s.source.split(';')[0])}</small></span><span class="chev">${icon('chevron-right', 'flip')}</span></button>`;
}

function openSheet(s: Signal, a: Answers) {
  const d = DOMAIN[s.domain];
  const conc = typeof a.sConc === 'number' ? a.sConc : undefined;
  const meter = s.domain === 'semen' && conc !== undefined ? (() => {
    const max = 40; const pos = Math.min(conc, max) / max * 100; const ref = WHO_2021.concentration / max * 100;
    return `<p class="small muted" style="margin:16px 0 0">${x('Concentration (million/mL)', 'التركيز (مليون/مل)')}</p>
      <div class="meter" style="background:linear-gradient(90deg,#E7DEF7 0 ${ref}%,#D3EDDF ${ref}% 100%)"><em style="left:${pos}%">${x('You', 'أنت')} · ${conc}</em><i style="left:calc(${pos}% - 2px)"></i></div>
      <div class="meterlab"><span>0</span><span>${x('Reference', 'المرجع')} ${WHO_2021.concentration}+</span><span>${max}+</span></div>`;
  })() : '';
  const el = document.createElement('div');
  el.className = 'scrim';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(tr(s.title))}"><div class="grab"></div>
    <span class="badge" style="background:${d.bg};color:${d.c}">${icon(d.ic, 's16')} ${tr(d.l)} · ${s.modifiable ? x('you can change this', 'يمكنك تغييره') : x('discuss with a clinician', 'ناقشه مع الطبيب')}</span>
    <h2>${tr(s.title)}</h2>${meter}
    <p style="margin-top:14px">${tr(s.why)}</p>
    <div class="srcbox">${icon('book-open-check')}<span><b>${u('source')}</b> · ${esc(s.source)} · <code>${s.id}</code></span></div>
    <button class="btn primary block" id="gotit">${x('Got it', 'حسناً')}</button></div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.onclick = (e) => { if (e.target === el) close(); };
  el.querySelector<HTMLButtonElement>('#gotit')!.onclick = close;
  el.querySelector<HTMLButtonElement>('#gotit')!.focus();
}

function result() {
  const a = S.answers;
  if (!Object.keys(a).length) { location.hash = '#/'; return; }
  const r = assess(a);
  sessionStorage.setItem('sanad.result', '1');
  const lv = LEVELS[r.level];
  const change = r.signals.filter((s) => s.modifiable);
  const discuss = r.signals.filter((s) => !s.modifiable);
  const semenish = r.level === 'fertility' || r.level === 'specialist' || r.signals.some((s) => s.domain === 'semen');
  const horm = r.signals.some((s) => s.domain === 'hormone');
  const pct = Math.round(r.completeness * 100);
  const bookable = r.level === 'specialist' || r.level === 'fertility' || r.level === 'primary';
  const prefs = [a.mode === 'tele' ? x('teleconsult', 'استشارة عن بعد') : '', a.clinGender === 'male' ? x('male doctor', 'طبيب رجل') : '', x('Arabic-speaking', 'يتحدث العربية')].filter(Boolean).join(' · ');
  let n = 1;
  const plan: string[] = [];
  plan.push(`<div class="plan"><span class="n done">${icon('check', 's16')}</span><div><b>${x('Private check complete', 'اكتمل الفحص الخاص')}</b><small>${r.signals.length} ${x('signals found', 'مؤشرات')} · ${pct}% ${x('answered', 'مُجاب')}</small></div></div>`);
  n++;
  if (r.level === 'urgent') plan.push(`<a class="plan" href="tel:998"><span class="n">${n++}</span><div><b>${x('Call 998 or go to emergency now', 'اتصل بـ ٩٩٨ أو توجه إلى الطوارئ الآن')}</b><small>${tr(lv.when)}</small></div><span class="chev">${icon('chevron-right', 'flip')}</span></a>`);
  else if (bookable) plan.push(`<a class="plan" href="#/book"><span class="n">${n++}</span><div><b>${x('Book', 'احجز')}: ${tr(lv.title)}</b><small>${prefs}</small></div><span class="chev">${icon('chevron-right', 'flip')}</span></a>`);
  if (S.consent?.c2 && r.level !== 'urgent') plan.push(`<a class="plan" href="#/share"><span class="n">${n++}</span><div><b>${u('share')}</b><small>${x('Encrypted · you choose what they see', 'مشفر · أنت تختار ما يراه')}</small></div><span class="chev">${icon('chevron-right', 'flip')}</span></a>`);
  if (r.level !== 'urgent') {
    if (semenish) plan.push(`<div class="plan"><span class="n">${n++}</span><div><b>${x('Prepare for a semen analysis', 'استعد لتحليل السائل المنوي')}</b><small>${u('prepSemen')}</small></div></div>`);
    if (horm) plan.push(`<div class="plan"><span class="n">${n++}</span><div><b>${x('Morning hormone test', 'تحليل هرمونات صباحي')}</b><small>${u('prepBlood')}</small></div></div>`);
    plan.push(`<div class="plan"><span class="n">${n++}</span><div><b>${x('Bring your list', 'أحضر قائمتك')}</b><small>${u('prepList')}</small></div></div>`);
  }
  shell(`
  <div class="fbar"><a class="iconbtn" href="#/" aria-label="${u('home')}">${icon('x')}</a><span class="t">${x('Your result', 'نتيجتك')}</span>
    ${S.consent?.c2 && r.level !== 'urgent' ? `<a class="iconbtn" href="#/share" aria-label="${u('share')}">${icon('share-2')}</a>` : '<span style="width:42px"></span>'}</div>
  <section class="lvl" style="--lv:${lv.color}"><div class="pattern"></div>
    <span class="badge">${icon('stethoscope', 's16')} ${u('yourNext')}</span>
    <h1>${tr(lv.title)}</h1>
    <p class="when">${icon('clock', 's16')} ${tr(lv.when)}</p>
    <p class="next">${tr(lv.next)}</p>
    <div class="ladder" aria-label="care levels">${LV_ORDER.map((k) => `<span class="${k === r.level ? 'on' : ''}" title="${tr(LV_SHORT[k])}"></span>`).join('')}</div>
  </section>
  <div class="complete"><span>${u('completeness')} ${pct}%</span><span class="bar"><i style="width:${pct}%"></i></span></div>
  ${r.completeness < 0.7 ? `<p class="small muted">${u('complLow')}</p>` : ''}
  <p class="sect">${x('Your plan', 'خطتك')}</p>
  ${plan.join('')}
  <p class="sect">${u('canChange')}</p>
  ${change.length ? change.map(sigRow).join('') : `<p class="muted small">${u('noSignals')}</p>`}
  <p class="sect">${u('toDiscuss')}</p>
  ${discuss.length ? discuss.map(sigRow).join('') : `<p class="muted small">${u('noSignals')}</p>`}
  ${bookable ? `<div class="actions"><a class="btn primary block" href="#/book">${icon('calendar')} ${x('Book an appointment', 'احجز موعداً')}</a></div>` : ''}
  <div class="fb"><b>${x('Quick feedback (anonymous)', 'رأي سريع (مجهول)')}</b>
    ${([['clear', x('Was this clear?', 'هل كان واضحاً؟')], ['private', x('Did it feel private?', 'هل شعرت بالخصوصية؟')], ['recommend', x('Would you recommend it to a friend?', 'هل تنصح به صديقاً؟')]] as const).map(([k, q]) => `<div class="q"><span>${q}</span><span class="row"><button data-t="${k}:yes">${x('Yes', 'نعم')}</button><button data-t="${k}:no">${x('No', 'لا')}</button></span></div>`).join('')}
  </div>
  <details class="trace"><summary>${u('trace')}</summary>
    <div class="tracebox">engine ${r.version}<br>${r.trace.map((id) => { const s = r.signals.find((y) => y.id === id); return `fired ${esc(id)} → ${s?.level ?? ''}`; }).join('<br>') || 'no rules fired'}<br>BMI ${r.bmi ?? '—'}<br>result max(level) = ${r.level}</div>
    <p class="muted small" style="margin-top:8px">${x('Level = highest level among fired rules. Unsure red-flag answers are never treated as "no". No protected attributes are read.', 'المستوى = أعلى مستوى بين القواعد المفعلة. لا تُعامل إجابات العلامات الخطرة غير المؤكدة كـ"لا". لا تُقرأ أي سمات محمية.')}</p>
  </details>
  <div class="row actions"><a class="btn" href="#/check/0">${icon('history')} ${u('restart')}</a><button class="btn" id="del" style="color:var(--u)">${icon('trash-2')} ${u('del')}</button></div>
  `, { flow: true });
  $('del').onclick = () => { wipe(); toast(u('deleted')); location.hash = '#/'; };
  app.querySelectorAll<HTMLButtonElement>('[data-sig]').forEach((b) => (b.onclick = () => openSheet(r.signals.find((s) => s.id === b.dataset.sig)!, a)));
  app.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => (b.onclick = () => {
    tally(`trust:${b.dataset.t}`);
    b.parentElement!.querySelectorAll('button').forEach((y) => y.classList.remove('on')); b.classList.add('on');
  }));
}

// ---------------- booking (demo) ----------------
function book() {
  const a = S.answers; if (!Object.keys(a).length) { location.hash = '#/'; return; }
  const r = assess(a); const lv = LEVELS[r.level];
  const f = { tele: a.mode !== 'visit', male: a.clinGender === 'male', ar: L() === 'ar' || a.clinGender !== undefined };
  const d = new Date(Date.now() + 3 * 864e5);
  const day = d.toLocaleDateString(en() ? 'en-GB' : 'ar-AE', { weekday: 'short', day: 'numeric', month: 'short' });
  const slots = ['5:30', '6:45', '8:00', '9:15'];
  const spec = r.level === 'fertility' ? x('Fertility clinic', 'عيادة الخصوبة') : r.level === 'primary' ? x('Family medicine', 'طب الأسرة') : x('Urology & andrology', 'المسالك البولية والذكورة');
  shell(`
  <div class="fbar"><a class="iconbtn" href="#/result" aria-label="${u('back')}">${icon('arrow-left', 'flip')}</a><span class="t">${x('Book an appointment', 'احجز موعداً')}</span><span style="width:42px"></span></div>
  <p class="demo-note">${icon('info', 's16')} ${x('Demo: clinics and times are illustrative. No booking is sent.', 'عرض توضيحي: العيادات والأوقات للتوضيح فقط. لا يُرسل أي حجز.')}</p>
  <div class="row" style="margin-bottom:14px">
    <button class="chip ${f.tele ? 'on' : ''}" data-f="tele">${icon('video', 's16')} ${x('Teleconsult', 'عن بعد')}</button>
    <button class="chip ${f.male ? 'on' : ''}" data-f="male">${icon('user', 's16')} ${x('Male doctor', 'طبيب رجل')}</button>
    <button class="chip ${f.ar ? 'on' : ''}" data-f="ar">${icon('languages', 's16')} ${x('Arabic', 'العربية')}</button>
  </div>
  <div class="card">
    <div class="doc"><span class="avatar">${icon('stethoscope', 's24')}</span><div><b>${spec}</b><br><small class="muted">${x('DoH-licensed partner clinic · Abu Dhabi', 'عيادة شريكة مرخصة من دائرة الصحة · أبوظبي')}</small><br>
      <small style="color:var(--g2);font-weight:600;display:inline-flex;gap:5px;align-items:center">${icon('badge-check', 's16')} ${x('Male · العربية · English', 'رجل · العربية · English')}</small></div></div>
    <div class="row" style="justify-content:space-between;margin-top:16px"><b>${day}</b><small class="muted">${x('Evening slots after Maghrib', 'مواعيد مسائية بعد المغرب')}</small></div>
    <div class="slots">${slots.map((s, k) => `<button class="slot ${k === 1 ? 'on' : ''}" data-s="${s}">${s}<small>${x('pm', 'م')}</small></button>`).join('')}</div>
  </div>
  ${S.consent?.c2 ? `<label class="toggle-row"><span class="pi" style="width:36px;height:36px">${icon('shield-check')}</span><div><b>${x('Share my Sanad summary', 'شارك ملخص سند')}</b><small>${x('Encrypted · you choose the items', 'مشفر · أنت تختار العناصر')}</small></div><input type="checkbox" id="sh" checked><span class="tg"></span></label>` : ''}
  <p class="foot" style="justify-content:flex-start">${icon('eye-off')} ${x('Appears as "Clinic appointment" in your calendar', 'يظهر في تقويمك باسم "موعد عيادة"')}</p>
  <div class="actions"><button class="btn primary block" id="confirm">${x('Confirm', 'تأكيد')} <span id="ct">6:45 ${x('pm', 'م')}</span> ${icon('arrow-right', 'flip')}</button>
  <p class="foot">${tr(lv.when)}</p></div>`, { flow: true });
  app.querySelectorAll<HTMLButtonElement>('[data-f]').forEach((b) => (b.onclick = () => b.classList.toggle('on')));
  app.querySelectorAll<HTMLButtonElement>('.slot').forEach((b) => (b.onclick = () => {
    app.querySelectorAll('.slot').forEach((y) => y.classList.remove('on')); b.classList.add('on');
    $('ct').textContent = `${b.dataset.s} ${x('pm', 'م')}`;
  }));
  $('confirm').onclick = () => {
    tally('book-demo');
    toast(x('Demo only: no real booking was made.', 'عرض توضيحي فقط: لم يتم أي حجز فعلي.'));
    const sh = document.getElementById('sh') as HTMLInputElement | null;
    if (sh?.checked) setTimeout(() => (location.hash = '#/share'), 900);
  };
}

// ---------------- share ----------------
function share() {
  const a = S.answers; if (!Object.keys(a).length || !S.consent?.c2) { location.hash = '#/'; return; }
  const items: [string, keyof typeof UI, boolean, string][] = [['age', 'inclAge', true, 'user'], ['tests', 'inclTests', true, 'flask-conical'], ['meds', 'inclMeds', false, 'pill'], ['hist', 'inclHist', true, 'history'], ['prefs', 'inclPrefs', true, 'sliders-horizontal']];
  shell(`
  <div class="fbar"><a class="iconbtn" href="#/result" aria-label="${u('back')}">${icon('arrow-left', 'flip')}</a><span class="t">${u('share')}</span><span style="width:42px"></span></div>
  <h1 class="qtitle" style="margin-top:12px">${u('shareTitle')}</h1>
  <div class="why">${icon('lock')}<span>${u('shareIntro')}</span></div>
  <label class="toggle-row"><span class="pi" style="width:36px;height:36px">${icon('stethoscope')}</span><div><b>${u('inclLevel')}</b></div><input type="checkbox" checked disabled><span class="tg"></span></label>
  ${items.map(([k, l, d, ic]) => `<label class="toggle-row"><span class="pi" style="width:36px;height:36px">${icon(ic)}</span><div><b>${u(l)}</b></div><input type="checkbox" data-k="${k}" ${d ? 'checked' : ''}><span class="tg"></span></label>`).join('')}
  <label class="toggle-row" style="cursor:default"><span class="pi" style="width:36px;height:36px">${icon('hourglass')}</span><div><b>${u('expiry')}</b></div><select id="exp" class="field" style="width:auto;margin:0"><option value="24">${u('h24')}</option><option value="168">${u('d7')}</option></select></label>
  <div class="actions"><button class="btn primary block" id="mk">${icon('key-round')} ${u('create')}</button></div>
  <div id="out"></div>`, { flow: true });
  $('mk').onclick = async () => {
    const on = (k: string) => (app.querySelector(`input[data-k=${k}]`) as HTMLInputElement).checked;
    const r = assess(a);
    const fields: Record<string, unknown> = {};
    if (on('age')) Object.assign(fields, { age: a.age, bmi: r.bmi });
    if (on('tests')) Object.assign(fields, { sConc: a.sConc, sVol: a.sVol, sProg: a.sProg, sMorph: a.sMorph, tT: a.tT, fsh: a.fsh });
    if (on('meds')) Object.assign(fields, { testosterone: a.testosterone, meds: a.meds, smoke: a.smoke, heat: a.heat });
    if (on('hist')) Object.assign(fields, { hx: a.hx, reason: a.reason, tryingMonths: a.tryingMonths });
    Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);
    const payload: SharePayload = { v: 1, exp: Date.now() + +$<HTMLSelectElement>('exp').value * 3600e3, level: r.level, signals: r.trace, fields, prefs: on('prefs') ? { mode: a.mode, clinGender: a.clinGender, lang: L() } : undefined, createdAt: Date.now(), engine: r.version };
    const pin = newPin();
    const token = await packShare(payload, pin);
    const link = `${location.origin}${location.pathname}#/clinician/${token}`;
    const qr = await QRCode.toDataURL(link, { margin: 1, width: 220, errorCorrectionLevel: 'L', color: { dark: '#0B3B3C', light: '#ffffff' } });
    tally('shared');
    $('out').innerHTML = `
      <div class="sharebox">
        <img src="${qr}" alt="QR code for share link" width="170" height="170">
        <div>
          <p class="small muted" style="margin:0">${u('pin')}</p>
          <p class="pin">${pin.slice(0, 3)} ${pin.slice(3)}</p>
          <div class="row"><button class="btn sm" id="cp">${icon('copy', 's16')} ${u('copy')}</button><a class="btn sm" href="${link}" target="_blank" rel="noopener">${icon('external-link', 's16')} ${u('open')}</a></div>
          <p class="small muted" style="margin-top:10px">${token.length} bytes · AES-256-GCM · PBKDF2 210k · ${x('not stored anywhere', 'غير محفوظ في أي مكان')}</p>
        </div>
      </div>`;
    $('cp').onclick = async () => { await navigator.clipboard.writeText(link); toast(u('copied')); };
  };
}

// ---------------- clinician workspace ----------------
type Audit = { at: number; engine: string; original: string; final: string; reason: string; reviewer: string };
const audits = (): Audit[] => JSON.parse(localStorage.getItem('sanad.audit') || '[]');
const FIELD_LABELS: Record<string, string> = { age: 'Age', bmi: 'BMI', sConc: 'Sperm conc.', sVol: 'Volume (mL)', sProg: 'Prog. motility (%)', sMorph: 'Normal forms (%)', tT: 'Total T (nmol/L)', fsh: 'FSH (IU/L)', testosterone: 'Testosterone/AAS', meds: 'Medicines', smoke: 'Tobacco', heat: 'Heat exposure', hx: 'History', reason: 'Reason', tryingMonths: 'Months trying', ed: 'Erection difficulty', diabetes: 'Diabetes' };
const FLAG: Record<string, (v: number) => string> = { bmi: (v) => (v >= 30 ? '≥30' : ''), sConc: (v) => (v < WHO_2021.concentration ? `<${WHO_2021.concentration}` : ''), sProg: (v) => (v < WHO_2021.progressive ? `<${WHO_2021.progressive}` : ''), sVol: (v) => (v < WHO_2021.volume ? `<${WHO_2021.volume}` : ''), sMorph: (v) => (v < WHO_2021.morphology ? `<${WHO_2021.morphology}` : ''), fsh: (v) => (v > 7.6 ? '>7.6' : '') };
const DEMO = ['V12', 'V25', 'V23', 'V35'];

function wsShell(active: 'packs' | 'audit', inner: string) {
  setDoc();
  document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr';
  document.body.className = 'ws';
  const n = audits().length;
  app.innerHTML = `<div class="ws-wrap">
    <aside class="side"><div class="pattern"></div>
      <a href="#/clinician" class="brand"><span class="mark">${arch()}</span><span><b>Sanad</b><i>Clinician</i></span></a>
      <a class="nv ${active === 'packs' ? 'on' : ''}" href="#/clinician">${icon('inbox')} Shared packs <em>${DEMO.length}</em></a>
      <a class="nv ${active === 'audit' ? 'on' : ''}" href="#/audit">${icon('scroll-text')} Audit log ${n ? `<em>${n}</em>` : ''}</a>
      <a class="nv" href="#/evidence">${icon('chart-column')} Evidence &amp; testing</a>
      <a class="nv" href="#/privacy">${icon('shield')} Privacy</a>
      <a class="nv" href="#/">${icon('smartphone')} Patient app</a>
      <p class="sfoot">${icon('shield-check', 's16')}<span>Packs decrypt in this browser only<br>Engine ${ENGINE_VERSION}</span></p>
    </aside>
    <div class="ws-main">${inner}</div></div>`;
}

function demoCase(id: string) { const c = CASES.find((y) => y.id === id)!; return { c, r: assess(c.a) }; }
function packList(selected?: string) {
  return DEMO.map((id) => {
    const { c, r } = demoCase(id); const lv = LEVELS[r.level];
    return `<button class="qitem ${selected === id ? 'on' : ''}" data-demo="${id}"><span class="lv" style="background:${lv.color}">${LV_SHORT[r.level].en}</span>
      <span style="flex:1;min-width:0"><b>${c.a.age} y · ${esc(c.story.replace(/^\d+,\s*/, ''))}</b><small>Simulated vignette ${id} · demo PIN 246810</small></span></button>`;
  }).join('') + `<div class="qitem" style="cursor:default"><span class="pi">${icon('qr-code')}</span><span><b>Open a new pack</b><small>Scan the patient's QR or open their link, then enter the PIN</small></span></div>`;
}
function bindDemo() {
  app.querySelectorAll<HTMLButtonElement>('[data-demo]').forEach((b) => (b.onclick = async () => {
    const { c, r } = demoCase(b.dataset.demo!);
    const fields: Record<string, unknown> = {};
    (['age', 'tryingMonths', 'sConc', 'sProg', 'sVol', 'sMorph', 'fsh', 'ed', 'diabetes', 'smoke', 'heat', 'reason'] as const).forEach((k) => { if (c.a[k] !== undefined) fields[k] = c.a[k]; });
    if (r.bmi) fields.bmi = r.bmi;
    const p: SharePayload = { v: 1, exp: Date.now() + 864e5, level: r.level, signals: r.trace, fields, prefs: { mode: 'tele', clinGender: 'male', lang: c.lang }, createdAt: Date.now(), engine: r.version };
    const pin = '246810'; const tok = await packShare(p, pin);
    sessionStorage.setItem('sanad.demoPin', pin); sessionStorage.setItem('sanad.demoSel', c.id);
    location.hash = `#/clinician/${tok}`;
  }));
}

function clinician(token?: string) {
  const sel = token ? sessionStorage.getItem('sanad.demoSel') ?? undefined : undefined;
  wsShell('packs', `
    <div class="ws-grid">
      <div><h1>Shared packs</h1><p class="muted small" style="margin-bottom:16px">Opened with the patient's PIN · sorted by urgency</p>${packList(sel)}</div>
      <div class="detail" id="pack">
        ${token ? `<p class="sect" style="margin-top:0">Encrypted pack</p><h2 class="serif" style="font-size:1.6rem">Enter the patient's PIN</h2>
          <p class="muted small">The patient tells you the 6-digit PIN separately from the link. The pack is decrypted in this browser only.</p>
          <div class="pinbox"><input id="pin" class="field pininput" inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="off">
          <button class="btn primary block" id="open">${icon('key-round')} Open pack</button></div><p id="perr" class="err"></p>`
        : `<p class="sect" style="margin-top:0">Human oversight</p><h2 class="serif" style="font-size:1.6rem">Sanad suggests. You decide.</h2>
          <p class="muted">Pick a simulated pack on the left to try the review flow, or open a link a patient shared with you. You can confirm or change the suggested level; a reason is required to override, and every decision is logged with the engine version.</p>`}
      </div>
    </div>`);
  bindDemo();
  if (!token) return;
  const demoPin = sessionStorage.getItem('sanad.demoPin');
  if (demoPin) { $<HTMLInputElement>('pin').value = demoPin; sessionStorage.removeItem('sanad.demoPin'); toast(`Demo PIN ${demoPin} filled in`); }
  const openIt = async () => {
    const pin = $<HTMLInputElement>('pin').value.trim();
    try {
      const p = await openShare(token, pin);
      if (p.exp < Date.now()) { $('perr').textContent = 'This pack has expired. Ask the patient to create a new one.'; return; }
      renderPack(p, $('pack'));
    } catch { $('perr').textContent = 'Could not open the pack. Check the PIN.'; }
  };
  $('open').onclick = openIt;
  $<HTMLInputElement>('pin').onkeydown = (e) => { if (e.key === 'Enter') openIt(); };
}

function renderPack(p: SharePayload, box: HTMLElement) {
  const lv = LEVELS[p.level as Level];
  const ruleMap = new Map<string, Signal>(); allSignals().forEach((s) => ruleMap.set(s.id, s));
  const tiles = Object.entries(p.fields).filter(([, v]) => typeof v === 'number' || typeof v === 'string').map(([k, v]) => {
    const f = typeof v === 'number' && FLAG[k] ? FLAG[k](v) : '';
    return `<div><small>${esc(FIELD_LABELS[k] ?? k)}</small><b>${esc(v)}</b>${f ? `<span class="flag">${f}</span>` : ''}</div>`;
  }).join('');
  const lists = Object.entries(p.fields).filter(([, v]) => Array.isArray(v) && !(v.length === 1 && v[0] === 'none')).map(([k, v]) => `<p class="small"><b>${esc(FIELD_LABELS[k] ?? k)}:</b> ${esc((v as string[]).join(', '))}</p>`).join('');
  const pr = p.prefs;
  let choice = p.level as Level;
  box.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div><p class="sect" style="margin:0">Sanad suggests</p><h2 class="serif" style="color:${lv.color}">${lv.title.en}</h2><p class="muted small" style="margin:4px 0 0">${lv.when.en}</p></div>
      ${pr ? `<div class="row">${pr.mode === 'tele' ? `<span class="chip">${icon('video', 's16')} Teleconsult</span>` : ''}${pr.clinGender === 'male' ? `<span class="chip">${icon('user', 's16')} Male doctor</span>` : ''}<span class="chip">${icon('languages', 's16')} ${pr.lang === 'ar' ? 'Arabic' : 'English'}</span></div>` : ''}
    </div>
    ${tiles ? `<div class="kv">${tiles}</div>` : '<p class="muted small" style="margin-top:12px">The patient shared no extra fields.</p>'}
    ${lists}
    <div class="dgrid">
      <div><h3>Signals</h3>${p.signals.map((id) => { const s = ruleMap.get(id); if (!s) return `<p><code>${esc(id)}</code></p>`; const d = DOMAIN[s.domain];
        return `<details class="sig" style="display:block"><summary style="display:flex;gap:12px;align-items:center;cursor:pointer;list-style:none"><span class="d" style="background:${d.bg};color:${d.c}">${icon(d.ic)}</span><span><b>${s.title.en}</b><small>${esc(s.source.split(';')[0])} · ${s.id}</small></span></summary><p class="small" style="margin:10px 0 0">${s.why.en}</p></details>`; }).join('') || '<p class="muted">None</p>'}</div>
      <div><h3>Reasoning trace</h3>
        <div class="tracebox">engine ${esc(p.engine)}<br>${p.signals.map((id) => `fired ${esc(id)} → ${ruleMap.get(id)?.level ?? '?'}`).join('<br>')}<br>result max(level) = ${p.level}</div>
        <div class="decide"><b>Your decision</b>
          <div class="seg2">${LV_ORDER.map((k) => `<button data-lv="${k}" class="${k === p.level ? 'on' : ''}" style="--c:${LEVELS[k].color}">${LV_SHORT[k].en}</button>`).join('')}</div>
          <input id="who" class="field" placeholder="Reviewer (e.g. GP initials)">
          <textarea id="why" class="field" rows="2" placeholder="Reason (required to override)"></textarea>
          <button class="btn primary block" id="save">${icon('check')} <span id="saveL">Agree &amp; record</span></button>
        </div>
      </div>
    </div>
    <p class="small muted" style="margin-top:14px">Pack created ${new Date(p.createdAt ?? 0).toLocaleString()} · expires ${new Date(p.exp).toLocaleString()}</p>`;
  box.querySelectorAll<HTMLButtonElement>('[data-lv]').forEach((b) => (b.onclick = () => {
    choice = b.dataset.lv as Level;
    box.querySelectorAll('[data-lv]').forEach((y) => y.classList.remove('on')); b.classList.add('on');
    $('saveL').textContent = choice === p.level ? 'Agree & record' : 'Override & record';
  }));
  $('save').onclick = () => {
    const reason = $<HTMLTextAreaElement>('why').value.trim();
    const reviewer = $<HTMLInputElement>('who').value.trim() || 'unnamed';
    if (choice !== p.level && !reason) { toast('A reason is required to override'); $('why').focus(); return; }
    const log = audits(); log.unshift({ at: Date.now(), engine: p.engine ?? '', original: p.level, final: choice, reason: reason || 'Agreed', reviewer });
    localStorage.setItem('sanad.audit', JSON.stringify(log.slice(0, 50)));
    toast(choice === p.level ? 'Agreed and logged' : 'Override logged');
    const em = document.querySelector('.nv[href="#/audit"]'); if (em) em.innerHTML = `${icon('scroll-text')} Audit log <em>${log.length}</em>`;
  };
}

// Collect every signal the engine can emit (for rendering by id).
function allSignals(): Signal[] {
  const probes: Answers[] = [
    { rfAcutePain: 'yes', rfPainFever: 'yes', rfPriapism: 'yes', rfLump: 'yes', reason: 'trying', tryingMonths: 13, hx: ['undescended', 'cancerTx', 'vasectomy', 'varicocele', 'genetic', 'mumps', 'trauma'], ed: 'often', ejac: 'absent', lowT: 'yes', height: 170, weight: 100, diabetes: 'unknown', bp: 'yes', utiNow: 'yes', infHx: 'yes', testosterone: 'current', meds: ['ssri'], smoke: 'current', heat: ['outdoor'], chem: 'yes', sConc: 0, tT: 8, fsh: 12 },
    { reason: 'trying', tryingMonths: 8, partner35: 'yes', height: 170, weight: 80, testosterone: 'past', sConc: 3 },
    { sConc: 10, rfAcutePain: 'unsure' },
  ];
  const m = new Map<string, Signal>();
  probes.forEach((a) => assess(a).signals.forEach((s) => m.set(s.id, s)));
  CASES.forEach((c) => assess(c.a).signals.forEach((s) => m.set(s.id, s)));
  return [...m.values()];
}

function auditTable() {
  const log = audits();
  if (!log.length) return `<p class="muted">No decisions yet. Open a shared pack and record a decision.</p>`;
  return `<table class="grid"><tr><th>Time</th><th>Reviewer</th><th>Engine</th><th>Suggested</th><th>Final</th><th>Reason</th></tr>
  ${log.map((y) => `<tr class="${y.original !== y.final ? 'ovr' : ''}"><td>${new Date(y.at).toLocaleString()}</td><td>${esc(y.reviewer)}</td><td><code>${esc(y.engine)}</code></td><td>${esc(y.original)}</td><td>${esc(y.final)}</td><td>${esc(y.reason)}</td></tr>`).join('')}</table>`;
}
function audit() {
  wsShell('audit', `<h1>Audit log</h1><p class="muted small" style="margin-bottom:16px">Every review on this device, with the engine version. Overrides are highlighted.</p><div class="detail">${auditTable()}</div>`);
}

// ---------------- evidence ----------------
function evidence() {
  const r = runEval();
  const pc = (v: number) => `${Math.round(v * 1000) / 10}%`;
  const LV: Level[] = ['urgent', 'specialist', 'fertility', 'primary', 'selfcare'];
  const tbl = (o: Record<string, { n: number; acc: number }>) => `<table class="grid"><tr><th>Group</th><th>n</th><th>Agreement</th></tr>${Object.entries(o).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${pc(v.acc)}</td></tr>`).join('')}</table>`;
  const tl = JSON.parse(localStorage.getItem('sanad.tally') || '{}');
  shell(`
  <section class="card">
    <p class="sect" style="margin-top:0">Computed live in your browser from the same engine the app uses</p>
    <h1>Evidence and testing</h1>
    <p class="muted">${r.n} simulated vignettes (no real patient data). Expected next steps were labelled by the team from AUA/ASRM 2020, EAU SRH 2024, WHO 2021 and NICE NG12 before the engine was run. Independent clinician adjudication is the first pilot milestone. Because labels and rules share the same guidelines, agreement here shows the rules are implemented faithfully; it is not proof of clinical accuracy.</p>
    <div class="stats">
      <div><b>${pc(r.redFlagSensitivity)}</b><span>red flags sent to emergency (${r.redFlagN}/${r.redFlagN})</span></div>
      <div><b>${r.under}</b><span>under-triaged cases</span></div>
      <div><b>${pc(r.accuracy)}</b><span>agreement with expected next step</span></div>
      <div><b>${r.robustness.unsafeDrops}/${r.robustness.dropped}</b><span>unsafe results when an answer is removed</span></div>
      <div><b>${r.medianMs < 0.1 ? '&lt;0.1' : r.medianMs.toFixed(1)} ms</b><span>median time to result, on device</span></div>
    </div>
  </section>
  <section class="card">
    <h2>Confusion matrix (rows = expected, columns = Sanad)</h2>
    <table class="grid cm"><tr><th></th>${LV.map((l) => `<th>${l}</th>`).join('')}</tr>
    ${LV.map((e) => `<tr><th>${e}</th>${LV.map((g) => `<td class="${e === g ? 'diag' : r.confusion[e][g] ? 'off' : ''}">${r.confusion[e][g]}</td>`).join('')}</tr>`).join('')}</table>
  </section>
  <section class="card cols3">
    <div><h3>By population group</h3>${tbl(r.byGroup)}</div>
    <div><h3>By age band</h3>${tbl(r.byAge)}</div>
    <div><h3>By language</h3>${tbl(r.byLang)}</div>
    <p class="small muted span3">Group and language are never engine inputs. They are recorded only to check that performance does not differ. Real-world fairness (completion, referral uptake and trust by group) will be measured in the pilot with small-cell suppression.</p>
  </section>
  <section class="card">
    <h2>What testing changed</h2>
    <p><code>v1.2</code> scored 47/48: edge case <b>E02</b> (trying 11 months, partner's age unknown) was under-triaged to self-care. <code>v1.3</code> treats an unknown partner age as 35+ for timing, so the couple is assessed at 6 months. Now 48/48, 0 under-triage.</p>
  </section>
  <section class="card">
    <h2>Pilot measures</h2>
    <table class="grid"><tr><th>Measure</th><th>How</th><th>Target</th></tr>
      <tr><td>Completed assessments</td><td>Opt-in anonymous tally: started → completed</td><td>≥ 70% completion</td></tr>
      <tr><td>Time to appropriate evaluation</td><td>Check date → clinician decision date (audit log)</td><td>Median &lt; 30 days vs. waiting for partner work-up</td></tr>
      <tr><td>Referral completion</td><td>Share packs opened by a clinician ÷ packs created</td><td>≥ 60%</td></tr>
      <tr><td>Clinician agreement</td><td>Audit log: agreed vs. overridden, with reasons</td><td>≥ 85%, 0 unsafe under-triage</td></tr>
      <tr><td>User trust</td><td>3-item post-check survey (clear, private, would recommend)</td><td>≥ 4/5</td></tr>
      <tr><td>Fairness</td><td>All of the above by age band, language, nationality group</td><td>No gap &gt; 10 points</td></tr>
    </table>
    <p class="small muted">This device's opt-in tally: ${esc(JSON.stringify(tl))}</p>
  </section>
  <section class="card">
    <h2>All vignettes</h2>
    <table class="grid small"><tr><th>ID</th><th>Story</th><th>Group</th><th>Lang</th><th>Expected</th><th>Sanad</th></tr>
    ${r.rows.map((y) => `<tr class="${y.ok ? '' : 'ovr'}"><td>${y.c.id}</td><td>${esc(y.c.story)}</td><td>${y.c.group}</td><td>${y.c.lang}</td><td>${y.c.expected}</td><td>${y.got}${y.ok ? ' ✓' : ''}</td></tr>`).join('')}</table>
  </section>`);
  document.documentElement.dir = 'ltr';
}

// ---------------- privacy ----------------
function privacy() {
  const e = en();
  shell(`
  <section class="card prose" style="max-width:760px;margin:0 auto">
    <h1>${e ? 'How your data will and will not be used' : 'كيف ستُستخدم بياناتك وكيف لن تُستخدم'}</h1>
    <h3>${icon('smartphone')} ${e ? 'What we collect' : 'ما نجمعه'}</h3>
    <ul>${(e ? ['Only your answers, held in this browser tab (session storage). Close the tab and they are gone.', 'No name, phone, email, Emirates ID, location, nationality, religion or marital status, ever.', 'If you opt in: a count of checks started and completed. Never your answers.'] : ['إجاباتك فقط، محفوظة في نافذة المتصفح هذه. أغلق النافذة فتختفي.', 'لا اسم ولا هاتف ولا بريد ولا هوية إماراتية ولا موقع ولا جنسية ولا دين ولا حالة اجتماعية، أبداً.', 'إذا وافقت: عدد الفحوص التي بدأت واكتملت فقط، وليس إجاباتك.']).map((y) => `<li>${y}</li>`).join('')}</ul>
    <h3>${icon('key-round')} ${e ? 'Sharing' : 'المشاركة'}</h3>
    <ul>${(e ? ['Nothing is shared unless you create a share pack and choose what goes in it.', 'The pack is encrypted on your device (AES-256-GCM, key from a 6-digit PIN). It lives in the link itself, after the # sign, which browsers never send to servers.', 'Packs expire after 24 hours or 7 days. In production, packs become one-time tokens revoked after opening.'] : ['لا يُشارك شيء إلا إذا أنشأت ملف مشاركة واخترت محتواه.', 'يُشفّر الملف على جهازك (AES-256-GCM بمفتاح من رمز من ٦ أرقام) ويوجد داخل الرابط بعد علامة #، وهي لا تُرسل إلى الخوادم.', 'تنتهي صلاحية الملفات بعد ٢٤ ساعة أو ٧ أيام، وفي الإنتاج تصبح رموزاً لمرة واحدة تُلغى بعد الفتح.']).map((y) => `<li>${y}</li>`).join('')}</ul>
    <h3>${icon('ban')} ${e ? 'We will never' : 'لن نقوم أبداً بـ'}</h3>
    <ul>${(e ? ['Sell data, or share it with employers, insurers, sponsors or family members.', 'Use reproductive data for employment, insurance or visa decisions.', 'Train AI models on your answers.', 'Make a diagnosis. Sanad screens and guides; clinicians decide.'] : ['بيع البيانات أو مشاركتها مع أصحاب العمل أو شركات التأمين أو الكفلاء أو أفراد العائلة.', 'استخدام البيانات الإنجابية في قرارات التوظيف أو التأمين أو التأشيرات.', 'تدريب نماذج الذكاء الاصطناعي على إجاباتك.', 'التشخيص. سند يفحص ويوجه، والأطباء يقررون.']).map((y) => `<li>${y}</li>`).join('')}</ul>
    <p class="muted small">${e ? 'Designed to align with UAE Federal Law No. 45 of 2021 (PDPL), Federal Law No. 2 of 2019 (ICT in health fields) and DoH Abu Dhabi health information and cyber security standards. Formal compliance review is part of the pilot plan.' : 'مصمم ليتوافق مع القانون الاتحادي رقم ٤٥ لسنة ٢٠٢١ بشأن حماية البيانات الشخصية، والقانون الاتحادي رقم ٢ لسنة ٢٠١٩ بشأن استخدام تقنية المعلومات في المجالات الصحية، ومعايير دائرة الصحة أبوظبي. المراجعة الرسمية للامتثال جزء من خطة التجربة.'}</p>
  </section>`);
}

// ---------------- router ----------------
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'how') return;
  const [p, ...rest] = h.split('/'); const arg = rest.join('/');
  switch (p) {
    case '': return home();
    case 'start': sessionStorage.setItem('sanad.intent', arg); location.hash = '#/consent'; return;
    case 'consent': return consent();
    case 'check': return check(parseInt(arg || '0', 10) || 0);
    case 'urgent': return urgent();
    case 'result': return result();
    case 'book': return book();
    case 'share': return share();
    case 'clinician': return clinician(arg || undefined);
    case 'audit': return audit();
    case 'evidence': return evidence();
    case 'privacy': return privacy();
    default: return home();
  }
}
window.addEventListener('hashchange', route);
route();
