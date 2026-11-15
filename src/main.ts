import './style.css';
import QRCode from 'qrcode';
import { STEPS, type Answers, type Lang, type Question, type T } from './questions';
import { assess, LEVELS, ENGINE_VERSION, WHO_2021, type Level, type Signal } from './engine';
import { UI } from './i18n';
import { packShare, openShare, newPin, type SharePayload } from './share';
import { runEval } from './eval';
import { CASES } from './cases';

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
const tr = (x: T) => x[L()];
const u = (k: keyof typeof UI) => UI[k][L()];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const app = document.querySelector<HTMLDivElement>('#app')!;

function wipe() {
  sessionStorage.removeItem('sanad.answers'); sessionStorage.removeItem('sanad.consent'); sessionStorage.removeItem('sanad.result');
}

function tally(event: string) {
  // Opt-in, aggregate only: a count per event, no answers, no identifiers.
  if (!S.consent?.c3) return;
  const k = 'sanad.tally'; const t = JSON.parse(localStorage.getItem(k) || '{}');
  t[event] = (t[event] || 0) + 1; localStorage.setItem(k, JSON.stringify(t));
}

// ---------------- chrome ----------------
function shell(inner: string, opts: { wide?: boolean } = {}) {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  document.documentElement.lang = L();
  document.documentElement.dir = L() === 'ar' ? 'rtl' : 'ltr';
  app.innerHTML = `
  <header class="top">
    <a href="#/" class="brand" aria-label="Sanad home">${logo()}<span><b>Sanad</b><i>سند</i></span></a>
    <nav>
      <a href="#/evidence">${u('evidence')}</a>
      <a href="#/clinician">${u('clinician')}</a>
      <a href="#/privacy">${u('privacy')}</a>
      <button class="lang" id="lang" aria-label="Switch language">${L() === 'en' ? 'العربية' : 'English'}</button>
    </nav>
  </header>
  <main class="${opts.wide ? 'wide' : ''}">${inner}</main>
  <footer>
    <span>${u('notDx')}</span>
    <button class="link" id="wipe">${u('del')}</button>
    <span class="muted">${ENGINE_VERSION} · prototype · simulated data only</span>
  </footer>`;
  document.getElementById('lang')!.onclick = () => { S.lang = L() === 'en' ? 'ar' : 'en'; route(); };
  document.getElementById('wipe')!.onclick = () => { wipe(); localStorage.removeItem('sanad.tally'); toast(u('deleted')); location.hash = '#/'; };
  window.scrollTo(0, 0);
}

function logo() {
  return `<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#0f3d3e"/><path d="M11 29V18a9 9 0 0 1 18 0v11" fill="none" stroke="#e9d7a8" stroke-width="3" stroke-linecap="round"/><path d="M16 29v-9a4 4 0 0 1 8 0v9" fill="none" stroke="#e9d7a8" stroke-width="3" stroke-linecap="round" opacity=".55"/></svg>`;
}

function toast(msg: string) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2200);
}

// ---------------- home ----------------
function home() {
  const has = !!sessionStorage.getItem('sanad.result');
  shell(`
  <section class="hero">
    <p class="eyebrow">${L() === 'en' ? 'Private · Bilingual · Explainable' : 'خاص · ثنائي اللغة · قابل للتفسير'}</p>
    <h1>${u('tagline')}</h1>
    <p class="lead">${u('heroSub')}</p>
    <div class="row">
      <a class="btn primary" href="#/consent">${u('start')}</a>
      ${has ? `<a class="btn" href="#/result">${u('resume')}</a>` : ''}
    </div>
    <p class="note">${u('notDx')}</p>
  </section>
  <section class="pillars">
    ${[['p1t', 'p1', '🔒'], ['p2t', 'p2', '💬'], ['p3t', 'p3', '🩺']].map(([a, b, i]) => `<article><div class="ic">${i}</div><h3>${u(a as never)}</h3><p>${u(b as never)}</p></article>`).join('')}
  </section>
  <section class="flow">
    <h2>${L() === 'en' ? 'How it works' : 'كيف يعمل'}</h2>
    <ol>
      ${(L() === 'en'
        ? ['Safety questions first. Anything urgent stops the check and tells you where to go.', 'Private questions on history, lifestyle, metabolism, infections, medicines and any results you have.', 'Explainable signals, split into what you can change and what to discuss.', 'One clear next step: self-care, primary care, urology/andrology, couple fertility assessment, or emergency.', 'Optional: an encrypted pack you choose to share with a clinician, who reviews and can change the result.']
        : ['أسئلة السلامة أولاً. أي أمر عاجل يوقف الفحص ويرشدك إلى المكان المناسب.', 'أسئلة خاصة عن التاريخ الطبي ونمط الحياة والأيض والعدوى والأدوية وأي نتائج لديك.', 'مؤشرات مفسرة مقسمة إلى ما يمكنك تغييره وما تناقشه مع الطبيب.', 'خطوة تالية واضحة: رعاية ذاتية، رعاية أولية، مسالك/ذكورة، تقييم خصوبة للزوجين، أو طوارئ.', 'اختياري: ملف مشفر تختار مشاركته مع طبيب يراجع النتيجة ويمكنه تعديلها.']
      ).map((s) => `<li>${s}</li>`).join('')}
    </ol>
  </section>`);
}

// ---------------- consent ----------------
function consent() {
  shell(`
  <section class="card narrow">
    <h1>${u('consentTitle')}</h1>
    <label class="check"><input type="checkbox" id="c1" checked disabled><span>${u('c1')}</span></label>
    <label class="check"><input type="checkbox" id="c2" checked><span>${u('c2')}</span></label>
    <label class="check"><input type="checkbox" id="c3"><span>${u('c3')}</span></label>
    <p class="willnot">${u('willNot')}</p>
    <p class="muted small">${L() === 'en' ? 'You can withdraw at any time with "Delete my data" at the bottom of every page.' : 'يمكنك الانسحاب في أي وقت عبر "احذف بياناتي" أسفل كل صفحة.'}</p>
    <div class="row"><a class="btn" href="#/">${u('back')}</a><button class="btn primary" id="go">${u('agree')}</button></div>
  </section>`);
  document.getElementById('go')!.onclick = () => {
    S.consent = { c1: true, c2: (document.getElementById('c2') as HTMLInputElement).checked, c3: (document.getElementById('c3') as HTMLInputElement).checked };
    tally('started'); location.hash = '#/check/0';
  };
}

// ---------------- check ----------------
function renderQ(q: Question, a: Answers) {
  const val = a[q.id];
  const hint = q.hint ? `<p class="hint">${tr(q.hint)}</p>` : '';
  if (q.kind === 'number') {
    return `<div class="q"><label for="${q.id}">${tr(q.q)}</label>${hint}
      <div class="num"><input id="${q.id}" data-q="${q.id}" type="number" inputmode="decimal" min="${q.min}" max="${q.max}" step="${q.step ?? 1}" value="${val ?? ''}" placeholder="—"><span>${q.unit ?? ''}</span></div></div>`;
  }
  const multi = q.kind === 'multi';
  return `<fieldset class="q"><legend>${tr(q.q)}</legend>${hint}<div class="opts">
    ${q.options.map((o) => {
      const on = multi ? Array.isArray(val) && val.includes(o.v) : val === o.v;
      return `<button type="button" class="opt ${on ? 'on' : ''}" data-q="${q.id}" data-v="${o.v}" data-multi="${multi}" aria-pressed="${on}">${tr(o.l)}</button>`;
    }).join('')}</div></fieldset>`;
}

function check(i: number) {
  if (!S.consent) { location.hash = '#/consent'; return; }
  const step = STEPS[i]; if (!step) { location.hash = '#/result'; return; }
  const a = S.answers;
  const qs = step.questions.filter((q) => !q.showIf || q.showIf(a));
  const pct = Math.round((i / STEPS.length) * 100);
  shell(`
  <section class="card narrow">
    <div class="progress" aria-label="progress"><div style="width:${pct}%"></div></div>
    <p class="eyebrow">${u('stepOf')} ${i + 1} / ${STEPS.length}</p>
    <h1>${tr(step.title)}</h1>
    <p class="lead small">${tr(step.intro)}</p>
    ${step.id === 'tests' ? `<p class="hint">${L() === 'en' ? `WHO 2021 lower reference limits: concentration ${WHO_2021.concentration} M/mL, volume ${WHO_2021.volume} mL, progressive motility ${WHO_2021.progressive}%, normal forms ${WHO_2021.morphology}%.` : `الحدود المرجعية الدنيا لمنظمة الصحة العالمية ٢٠٢١: التركيز ${WHO_2021.concentration} مليون/مل، الحجم ${WHO_2021.volume} مل، الحركة التقدمية ${WHO_2021.progressive}٪، الأشكال الطبيعية ${WHO_2021.morphology}٪.`}</p>` : ''}
    <form id="f">${qs.map((q) => renderQ(q, a)).join('')}</form>
    <div class="row">
      <button class="btn" id="back">${u('back')}</button>
      <button class="btn primary" id="next">${i === STEPS.length - 1 ? u('finish') : u('next')}</button>
    </div>
  </section>`);

  app.querySelectorAll<HTMLButtonElement>('.opt').forEach((b) => (b.onclick = () => {
    const cur = S.answers; const id = b.dataset.q!; const v = b.dataset.v!;
    if (b.dataset.multi === 'true') {
      let arr = Array.isArray(cur[id]) ? [...(cur[id] as string[])] : [];
      if (v === 'none') arr = arr.includes('none') ? [] : ['none'];
      else { arr = arr.filter((x) => x !== 'none'); arr = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }
      cur[id] = arr;
    } else cur[id] = cur[id] === v ? undefined : v;
    S.answers = cur;
    const scroll = window.scrollY; check(i); window.scrollTo(0, scroll);
  }));
  app.querySelectorAll<HTMLInputElement>('input[type=number]').forEach((inp) => (inp.onchange = () => {
    const cur = S.answers; const n = parseFloat(inp.value);
    cur[inp.dataset.q!] = Number.isFinite(n) ? Math.min(Math.max(n, +inp.min), +inp.max) : undefined; S.answers = cur;
  }));
  document.getElementById('back')!.onclick = () => (location.hash = i === 0 ? '#/consent' : `#/check/${i - 1}`);
  document.getElementById('next')!.onclick = () => {
    app.querySelectorAll<HTMLInputElement>('input[type=number]').forEach((inp) => inp.dispatchEvent(new Event('change')));
    if (step.id === 'safety') {
      const r = assess(S.answers);
      if (r.redFlag) { location.hash = '#/urgent'; return; }
    }
    if (i === STEPS.length - 1) { tally('completed'); location.hash = '#/result'; } else location.hash = `#/check/${i + 1}`;
  };
}

function urgent() {
  const r = assess(S.answers);
  tally('urgent');
  const flags = r.signals.filter((s) => s.domain === 'red-flag' && s.level === 'urgent');
  shell(`
  <section class="card narrow urgent">
    <h1>⚠️ ${u('urgentStop')}</h1>
    ${flags.map((s) => `<h3>${tr(s.title)}</h3><p>${tr(s.why)}</p>`).join('')}
    <p class="big">${tr(LEVELS.urgent.next)}</p>
    <div class="row"><a class="btn danger" href="tel:998">📞 998</a><a class="btn" href="#/check/1">${u('continueAnyway')}</a></div>
    <p class="muted small">${L() === 'en' ? 'This message was triggered by a fixed safety rule, not a prediction. A clinician reviews every shared case.' : 'ظهرت هذه الرسالة بسبب قاعدة سلامة ثابتة وليست تنبؤاً، ويراجع الطبيب كل حالة مشتركة.'}</p>
  </section>`);
}

// ---------------- result ----------------
function signalCard(s: Signal, open = false) {
  return `<details class="sig lv-${s.level}" ${open ? 'open' : ''}><summary><span class="dot"></span>${tr(s.title)}</summary>
    <p>${tr(s.why)}</p><p class="src">${u('source')}: ${esc(s.source)} · <code>${s.id}</code></p></details>`;
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
  shell(`
  <section class="result" style="--lv:${lv.color}">
    <div class="levelcard">
      <p class="eyebrow">${u('yourNext')}</p>
      <h1>${tr(lv.title)}</h1>
      <p class="when"><b>${u('when')}:</b> ${tr(lv.when)}</p>
      <p>${tr(lv.next)}</p>
      ${a.mode === 'tele' ? `<p class="pill">📱 ${u('modeTele')}</p>` : ''}
      ${a.mode === 'home' && r.level !== 'urgent' ? `<p class="pill">🏠 ${u('modeHome')}</p>` : ''}
      ${a.clinGender === 'male' ? `<p class="pill">👤 ${u('maleClin')}</p>` : ''}
      <div class="ladder" aria-label="care levels">
        ${(['selfcare', 'primary', 'fertility', 'specialist', 'urgent'] as Level[]).map((k) => `<span class="${k === r.level ? 'on' : ''}" style="--c:${LEVELS[k].color}">${tr(LEVELS[k].title).split(':')[0]}</span>`).join('')}
      </div>
    </div>
    <div class="meter"><span>${u('completeness')}: ${Math.round(r.completeness * 100)}%</span><div><i style="width:${r.completeness * 100}%"></i></div>${r.completeness < 0.7 ? `<small>${u('complLow')}</small>` : ''}</div>
    <div class="cols">
      <div><h2>${u('canChange')}</h2>${change.length ? change.map((s) => signalCard(s)).join('') : `<p class="muted">${u('noSignals')}</p>`}</div>
      <div><h2>${u('toDiscuss')}</h2>${discuss.length ? discuss.map((s) => signalCard(s, s.domain === 'red-flag')).join('') : `<p class="muted">${u('noSignals')}</p>`}</div>
    </div>
    ${r.level !== 'urgent' ? `<div class="prep"><h2>${u('prepTitle')}</h2><ul>${semenish ? `<li>${u('prepSemen')}</li>` : ''}${horm ? `<li>${u('prepBlood')}</li>` : ''}<li>${u('prepList')}</li></ul></div>` : ''}
    <p class="note">${u('notDx')}</p>
    <div class="row">
      ${S.consent?.c2 ? `<a class="btn primary" href="#/share">🔐 ${u('share')}</a>` : ''}
      <a class="btn" href="#/check/0">${u('restart')}</a>
      <button class="btn ghost" id="del">${u('del')}</button>
    </div>
    <div class="trust"><b>${L() === 'en' ? 'Quick feedback (anonymous)' : 'رأي سريع (مجهول)'}</b>
      ${([['clear', L() === 'en' ? 'Was this clear?' : 'هل كان واضحاً؟'], ['private', L() === 'en' ? 'Did it feel private?' : 'هل شعرت بالخصوصية؟'], ['recommend', L() === 'en' ? 'Would you recommend it to a friend?' : 'هل تنصح به صديقاً؟']] as const).map(([k, q]) => `<span class="tq">${q} <button class="opt" data-t="${k}:yes">${L() === 'en' ? 'Yes' : 'نعم'}</button><button class="opt" data-t="${k}:no">${L() === 'en' ? 'No' : 'لا'}</button></span>`).join('')}
    </div>
    <details class="trace"><summary>${u('trace')}</summary>
      <p><code>${r.version}</code> · BMI ${r.bmi ?? '—'} · rules fired: ${r.trace.map((x) => `<code>${x}</code>`).join(' ') || '—'}</p>
      <p class="muted small">${L() === 'en' ? 'Level = highest level among fired rules. Unsure red-flag answers are never treated as "no". No protected attributes are read.' : 'المستوى = أعلى مستوى بين القواعد المفعلة. لا تُعامل إجابات العلامات الخطرة غير المؤكدة كـ"لا". لا تُقرأ أي سمات محمية.'}</p>
    </details>
  </section>`, { wide: true });
  document.getElementById('del')!.onclick = () => { wipe(); toast(u('deleted')); location.hash = '#/'; };
  app.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => (b.onclick = () => {
    tally(`trust:${b.dataset.t}`);
    b.parentElement!.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on');
  }));
}

// ---------------- share ----------------
function share() {
  const a = S.answers; if (!Object.keys(a).length || !S.consent?.c2) { location.hash = '#/'; return; }
  const items: [string, keyof typeof UI, boolean][] = [['age', 'inclAge', true], ['tests', 'inclTests', true], ['meds', 'inclMeds', false], ['hist', 'inclHist', true], ['prefs', 'inclPrefs', true]];
  shell(`
  <section class="card narrow">
    <h1>${u('shareTitle')}</h1>
    <p class="lead small">${u('shareIntro')}</p>
    <label class="check"><input type="checkbox" checked disabled><span>${u('inclLevel')}</span></label>
    ${items.map(([k, l, d]) => `<label class="check"><input type="checkbox" data-k="${k}" ${d ? 'checked' : ''}><span>${u(l)}</span></label>`).join('')}
    <label class="sel">${u('expiry')} <select id="exp"><option value="24">${u('h24')}</option><option value="168">${u('d7')}</option></select></label>
    <div class="row"><a class="btn" href="#/result">${u('back')}</a><button class="btn primary" id="mk">🔐 ${u('create')}</button></div>
    <div id="out"></div>
  </section>`);
  document.getElementById('mk')!.onclick = async () => {
    const on = (k: string) => (app.querySelector(`input[data-k=${k}]`) as HTMLInputElement).checked;
    const r = assess(a);
    const fields: Record<string, unknown> = {};
    if (on('age')) Object.assign(fields, { age: a.age, bmi: r.bmi });
    if (on('tests')) Object.assign(fields, { sConc: a.sConc, sVol: a.sVol, sProg: a.sProg, sMorph: a.sMorph, tT: a.tT, fsh: a.fsh });
    if (on('meds')) Object.assign(fields, { testosterone: a.testosterone, meds: a.meds, smoke: a.smoke, heat: a.heat });
    if (on('hist')) Object.assign(fields, { hx: a.hx, reason: a.reason, tryingMonths: a.tryingMonths });
    Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);
    const payload: SharePayload = { v: 1, exp: Date.now() + +(document.getElementById('exp') as HTMLSelectElement).value * 3600e3, level: r.level, signals: r.trace, fields, prefs: on('prefs') ? { mode: a.mode, clinGender: a.clinGender, lang: L() } : undefined, createdAt: Date.now(), engine: r.version };
    const pin = newPin();
    const token = await packShare(payload, pin);
    const link = `${location.origin}${location.pathname}#/clinician/${token}`;
    const qr = await QRCode.toDataURL(link, { margin: 1, width: 220, errorCorrectionLevel: 'L', color: { dark: '#0f3d3e', light: '#ffffff' } });
    tally('shared');
    document.getElementById('out')!.innerHTML = `
      <div class="sharebox">
        <img src="${qr}" alt="QR code for share link" width="180" height="180">
        <div>
          <p class="small muted">${u('pin')}</p>
          <p class="pin">${pin.slice(0, 3)} ${pin.slice(3)}</p>
          <div class="row"><button class="btn" id="cp">${u('copy')}</button><a class="btn ghost" href="${link}" target="_blank" rel="noopener">${u('open')} ↗</a></div>
          <p class="small muted">${token.length} bytes · AES-256-GCM · PBKDF2 210k · ${L() === 'en' ? 'not stored anywhere' : 'غير محفوظ في أي مكان'}</p>
        </div>
      </div>`;
    document.getElementById('cp')!.onclick = async () => { await navigator.clipboard.writeText(link); toast(u('copied')); };
  };
}

// ---------------- clinician ----------------
type Audit = { at: number; engine: string; original: string; final: string; reason: string; reviewer: string };
const audits = (): Audit[] => JSON.parse(localStorage.getItem('sanad.audit') || '[]');

const FIELD_LABELS: Record<string, string> = { age: 'Age', bmi: 'BMI', sConc: 'Sperm conc. (M/mL)', sVol: 'Volume (mL)', sProg: 'Progressive motility (%)', sMorph: 'Normal forms (%)', tT: 'Total T (nmol/L)', fsh: 'FSH (IU/L)', testosterone: 'Testosterone/AAS', meds: 'Medicines', smoke: 'Tobacco', heat: 'Heat exposure', hx: 'History', reason: 'Reason for visit', tryingMonths: 'Months trying' };

function clinician(token?: string) {
  shell(`
  <section class="card">
    <p class="eyebrow">Clinician workspace · human oversight</p>
    <h1>Review a shared pack</h1>
    <p class="lead small">Sanad suggests; the clinician decides. Open a pack with the patient's PIN, review the reasoning, then confirm or change the next step. Every decision is logged with the engine version.</p>
    ${token ? `<div class="row"><input id="pin" class="pininput" inputmode="numeric" maxlength="6" placeholder="6-digit PIN" autocomplete="off"><button class="btn primary" id="open">Open pack</button></div>` :
    `<div class="row"><button class="btn primary" id="demo">Load a demo pack</button><span class="muted small">Creates a pack from a simulated patient (vignette V25) so you can try the workflow.</span></div>`}
    <div id="pack"></div>
  </section>
  <section class="card">
    <h2>Audit log (this device)</h2>
    <div id="audit">${auditTable()}</div>
  </section>`, { wide: true });
  const demoPin = sessionStorage.getItem('sanad.demoPin');
  if (token && demoPin) { (document.getElementById('pin') as HTMLInputElement).value = demoPin; sessionStorage.removeItem('sanad.demoPin'); toast(`Demo PIN ${demoPin} filled in`); }
  if (!token) {
    document.getElementById('demo')!.onclick = async () => {
      const c = CASES.find((x) => x.id === 'V25')!; const r = assess(c.a);
      const p: SharePayload = { v: 1, exp: Date.now() + 864e5, level: r.level, signals: r.trace, fields: { age: c.a.age, ed: c.a.ed, diabetes: c.a.diabetes, reason: c.a.reason }, prefs: { mode: 'tele', clinGender: 'male', lang: 'ar' }, createdAt: Date.now(), engine: r.version };
      const pin = '246810'; const tok = await packShare(p, pin);
      sessionStorage.setItem('sanad.demoPin', pin);
      location.hash = `#/clinician/${tok}`;
    };
    return;
  }
  document.getElementById('open')!.onclick = async () => {
    const pin = (document.getElementById('pin') as HTMLInputElement).value.trim();
    const box = document.getElementById('pack')!;
    try {
      const p = await openShare(token, pin);
      if (p.exp < Date.now()) { box.innerHTML = `<p class="err">This pack has expired. Ask the patient to create a new one.</p>`; return; }
      renderPack(p, box);
    } catch { box.innerHTML = `<p class="err">Could not open the pack. Check the PIN.</p>`; }
  };
}

function renderPack(p: SharePayload, box: HTMLElement) {
  const lv = LEVELS[p.level as Level];
  const ruleMap = new Map<string, Signal>();
  const all = allSignals(); all.forEach((s) => ruleMap.set(s.id, s));
  const fields = Object.entries(p.fields).map(([k, v]) => `<tr><th>${esc(FIELD_LABELS[k] ?? k)}</th><td>${esc(Array.isArray(v) ? v.join(', ') : v)}</td></tr>`).join('');
  box.innerHTML = `
  <div class="packview" style="--lv:${lv.color}">
    <div class="levelcard compact"><p class="eyebrow">Sanad suggestion · ${esc(p.engine)}</p><h2>${lv.title.en}</h2><p>${lv.when.en}</p></div>
    <div class="cols">
      <div><h3>Signals (rule IDs)</h3>${p.signals.map((id) => ruleMap.get(id) ? signalCardEn(ruleMap.get(id)!) : `<p><code>${esc(id)}</code></p>`).join('') || '<p class="muted">None</p>'}</div>
      <div><h3>Shared fields</h3><table class="kv">${fields || '<tr><td class="muted">Patient shared no extra fields</td></tr>'}</table>
      ${p.prefs ? `<h3>Preferences</h3><p>${esc(p.prefs.mode)} · clinician: ${esc(p.prefs.clinGender)} · language: ${esc(p.prefs.lang)}</p>` : ''}
      <p class="small muted">Pack created ${new Date(p.createdAt ?? 0).toLocaleString()} · expires ${new Date(p.exp).toLocaleString()}</p></div>
    </div>
    <div class="decide">
      <h3>Your decision</h3>
      <div class="row">
        <select id="lvl">${(['urgent', 'specialist', 'fertility', 'primary', 'selfcare'] as Level[]).map((k) => `<option value="${k}" ${k === p.level ? 'selected' : ''}>${LEVELS[k].title.en}</option>`).join('')}</select>
        <input id="who" placeholder="Reviewer (e.g. GP, initials)" value="">
      </div>
      <textarea id="why" rows="2" placeholder="Reason (required if you change the level)"></textarea>
      <button class="btn primary" id="save">Record decision</button>
    </div>
  </div>`;
  document.getElementById('save')!.onclick = () => {
    const final = (document.getElementById('lvl') as HTMLSelectElement).value;
    const reason = (document.getElementById('why') as HTMLTextAreaElement).value.trim();
    const reviewer = (document.getElementById('who') as HTMLInputElement).value.trim() || 'unnamed';
    if (final !== p.level && !reason) { toast('A reason is required to override'); return; }
    const log = audits(); log.unshift({ at: Date.now(), engine: p.engine ?? '', original: p.level, final, reason: reason || 'Agreed', reviewer });
    localStorage.setItem('sanad.audit', JSON.stringify(log.slice(0, 50)));
    document.getElementById('audit')!.innerHTML = auditTable();
    toast(final === p.level ? 'Agreed and logged' : 'Override logged');
  };
}

function signalCardEn(s: Signal) {
  return `<details class="sig lv-${s.level}"><summary><span class="dot"></span>${s.title.en}</summary><p>${s.why.en}</p><p class="src">${esc(s.source)} · <code>${s.id}</code></p></details>`;
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
  return [...m.values()];
}

function auditTable() {
  const log = audits();
  if (!log.length) return `<p class="muted">No decisions yet.</p>`;
  return `<table class="grid"><tr><th>Time</th><th>Reviewer</th><th>Engine</th><th>Suggested</th><th>Final</th><th>Reason</th></tr>
  ${log.map((x) => `<tr class="${x.original !== x.final ? 'ovr' : ''}"><td>${new Date(x.at).toLocaleString()}</td><td>${esc(x.reviewer)}</td><td><code>${esc(x.engine)}</code></td><td>${esc(x.original)}</td><td>${esc(x.final)}</td><td>${esc(x.reason)}</td></tr>`).join('')}</table>`;
}

// ---------------- evidence ----------------
function evidence() {
  const r = runEval();
  const pc = (x: number) => `${Math.round(x * 1000) / 10}%`;
  const LV: Level[] = ['urgent', 'specialist', 'fertility', 'primary', 'selfcare'];
  const tbl = (o: Record<string, { n: number; acc: number }>) => `<table class="grid"><tr><th>Group</th><th>n</th><th>Agreement</th></tr>${Object.entries(o).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${pc(v.acc)}</td></tr>`).join('')}</table>`;
  const tally = JSON.parse(localStorage.getItem('sanad.tally') || '{}');
  shell(`
  <section class="card">
    <p class="eyebrow">Computed live in your browser from the same engine the app uses</p>
    <h1>Evidence and testing</h1>
    <p class="lead small">${r.n} simulated vignettes (no real patient data). Expected next steps were labelled by the team from AUA/ASRM 2020, EAU SRH 2024, WHO 2021 and NICE NG12 before the engine was run. Independent clinician adjudication is the first pilot milestone. Because labels and rules share the same guidelines, agreement here shows the rules are implemented faithfully; it is not proof of clinical accuracy.</p>
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
    <p class="small muted">This device's opt-in tally: ${esc(JSON.stringify(tally))}</p>
  </section>
  <section class="card">
    <h2>All vignettes</h2>
    <table class="grid small"><tr><th>ID</th><th>Story</th><th>Group</th><th>Lang</th><th>Expected</th><th>Sanad</th></tr>
    ${r.rows.map((x) => `<tr class="${x.ok ? '' : 'ovr'}"><td>${x.c.id}</td><td>${esc(x.c.story)}</td><td>${x.c.group}</td><td>${x.c.lang}</td><td>${x.c.expected}</td><td>${x.got}${x.ok ? ' ✓' : ''}</td></tr>`).join('')}</table>
  </section>`, { wide: true });
}

// ---------------- privacy ----------------
function privacy() {
  const en = L() === 'en';
  shell(`
  <section class="card narrow prose">
    <h1>${en ? 'How your data will and will not be used' : 'كيف ستُستخدم بياناتك وكيف لن تُستخدم'}</h1>
    <h3>${en ? 'What we collect' : 'ما نجمعه'}</h3>
    <ul>${(en ? ['Only your answers, held in this browser tab (session storage). Close the tab and they are gone.', 'No name, phone, email, Emirates ID, location, nationality, religion or marital status, ever.', 'If you opt in: a count of checks started and completed. Never your answers.'] : ['إجاباتك فقط، محفوظة في نافذة المتصفح هذه. أغلق النافذة فتختفي.', 'لا اسم ولا هاتف ولا بريد ولا هوية إماراتية ولا موقع ولا جنسية ولا دين ولا حالة اجتماعية، أبداً.', 'إذا وافقت: عدد الفحوص التي بدأت واكتملت فقط، وليس إجاباتك.']).map((x) => `<li>${x}</li>`).join('')}</ul>
    <h3>${en ? 'Sharing' : 'المشاركة'}</h3>
    <ul>${(en ? ['Nothing is shared unless you create a share pack and choose what goes in it.', 'The pack is encrypted on your device (AES-256-GCM, key from a 6-digit PIN). It lives in the link itself, after the # sign, which browsers never send to servers.', 'Packs expire after 24 hours or 7 days. In production, packs become one-time tokens revoked after opening.'] : ['لا يُشارك شيء إلا إذا أنشأت ملف مشاركة واخترت محتواه.', 'يُشفّر الملف على جهازك (AES-256-GCM بمفتاح من رمز من ٦ أرقام) ويوجد داخل الرابط بعد علامة #، وهي لا تُرسل إلى الخوادم.', 'تنتهي صلاحية الملفات بعد ٢٤ ساعة أو ٧ أيام، وفي الإنتاج تصبح رموزاً لمرة واحدة تُلغى بعد الفتح.']).map((x) => `<li>${x}</li>`).join('')}</ul>
    <h3>${en ? 'We will never' : 'لن نقوم أبداً بـ'}</h3>
    <ul>${(en ? ['Sell data, or share it with employers, insurers, sponsors or family members.', 'Use reproductive data for employment, insurance or visa decisions.', 'Train AI models on your answers.', 'Make a diagnosis. Sanad screens and guides; clinicians decide.'] : ['بيع البيانات أو مشاركتها مع أصحاب العمل أو شركات التأمين أو الكفلاء أو أفراد العائلة.', 'استخدام البيانات الإنجابية في قرارات التوظيف أو التأمين أو التأشيرات.', 'تدريب نماذج الذكاء الاصطناعي على إجاباتك.', 'التشخيص. سند يفحص ويوجه، والأطباء يقررون.']).map((x) => `<li>${x}</li>`).join('')}</ul>
    <p class="muted small">${en ? 'Designed to align with UAE Federal Law No. 45 of 2021 (PDPL), Federal Law No. 2 of 2019 (ICT in health fields) and DoH Abu Dhabi health information and cyber security standards. Formal compliance review is part of the pilot plan.' : 'مصمم ليتوافق مع القانون الاتحادي رقم ٤٥ لسنة ٢٠٢١ بشأن حماية البيانات الشخصية، والقانون الاتحادي رقم ٢ لسنة ٢٠١٩ بشأن استخدام تقنية المعلومات في المجالات الصحية، ومعايير دائرة الصحة أبوظبي. المراجعة الرسمية للامتثال جزء من خطة التجربة.'}</p>
  </section>`);
}

// ---------------- router ----------------
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, arg] = [h.split('/')[0], h.split('/').slice(1).join('/')];
  switch (p) {
    case '': return home();
    case 'consent': return consent();
    case 'check': return check(parseInt(arg || '0', 10));
    case 'urgent': return urgent();
    case 'result': return result();
    case 'share': return share();
    case 'clinician': return clinician(arg || undefined);
    case 'evidence': return evidence();
    case 'privacy': return privacy();
    default: return home();
  }
}
window.addEventListener('hashchange', route);
route();

