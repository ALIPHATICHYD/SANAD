"""Fill the Future Health submission template for Sanad.
Usage: python3 build_deck.py <template.pptx> <shots_dir> <out.pptx>
"""
import sys
from pptx import Presentation
from pptx.util import Emu, Pt, Inches
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

TPL, SHOTS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ARCH = '/home/user/sanad/docs/architecture.png'
URL = 'https://sanad-health-psi.vercel.app'

INK = RGBColor(0x14, 0x23, 0x2B)
MUTED = RGBColor(0x5B, 0x6B, 0x73)
TEAL = RGBColor(0x0F, 0x3D, 0x3E)
GOLD = RGBColor(0xC8, 0xA9, 0x6A)
SAND = RGBColor(0xEF, 0xE5, 0xD1)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
FONT = 'Inter'

prs = Presentation(TPL)
S = prs.slides
L, W = Inches(0.33), Inches(9.34)
TOP = Inches(1.42)


def label_box(slide):
    for sh in slide.shapes:
        if sh.has_text_frame and sh.text_frame.text.strip():
            return sh


def tighten_label(slide):
    sh = label_box(slide)
    sh.top = Inches(0.78)
    sh.height = Inches(0.6)
    return sh


def text(slide, x, y, w, h, paras, size=10.5, color=INK, anchor=MSO_ANCHOR.TOP):
    """paras: list of str | (str, dict) where dict may have bold,size,color,bullet,space"""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Inches(0.05)
    tf.margin_top = tf.margin_bottom = Inches(0.02)
    first = True
    for p in paras:
        opts = {}
        if isinstance(p, tuple):
            p, opts = p
        para = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        bullet = opts.get('bullet', False)
        para.space_after = Pt(opts.get('space', 3))
        segs = p.split('**')
        if bullet:
            r = para.add_run(); r.text = '•  '; r.font.size = Pt(opts.get('size', size)); r.font.color.rgb = GOLD; r.font.name = FONT; r.font.bold = True
        for i, seg in enumerate(segs):
            if not seg:
                continue
            r = para.add_run()
            r.text = seg
            r.font.name = FONT
            r.font.size = Pt(opts.get('size', size))
            r.font.bold = opts.get('bold', False) or (i % 2 == 1)
            r.font.color.rgb = opts.get('color', color)
    return tb


def table(slide, x, y, w, rows, colw, size=8.5, rowh=0.24, header_fill=TEAL):
    shp = slide.shapes.add_table(len(rows), len(rows[0]), x, y, w, Inches(rowh * len(rows)))
    t = shp.table
    for j, cw in enumerate(colw):
        t.columns[j].width = Inches(cw)
    for i, row in enumerate(rows):
        t.rows[i].height = Inches(rowh)
        for j, val in enumerate(row):
            c = t.cell(i, j)
            c.margin_left = c.margin_right = Inches(0.05)
            c.margin_top = c.margin_bottom = Inches(0.02)
            c.fill.solid()
            c.fill.fore_color.rgb = header_fill if i == 0 else (WHITE if i % 2 else RGBColor(0xF8, 0xF4, 0xEC))
            tf = c.text_frame
            tf.word_wrap = True
            tf.paragraphs[0].text = ''
            segs = str(val).split('**')
            for k, seg in enumerate(segs):
                if not seg:
                    continue
                r = tf.paragraphs[0].add_run()
                r.text = seg
                r.font.name = FONT
                r.font.size = Pt(size)
                r.font.bold = (i == 0) or (k % 2 == 1)
                r.font.color.rgb = WHITE if i == 0 else INK
    return t


def pic(slide, path, x, y, w=None, h=None, border=True):
    p = slide.shapes.add_picture(path, x, y, w, h)
    if border:
        p.line.color.rgb = RGBColor(0xE5, 0xDC, 0xCB)
        p.line.width = Pt(0.75)
    return p


def chip(slide, x, y, w, h, title, body, fill=SAND, size=9):
    from pptx.enum.shapes import MSO_SHAPE
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    s.adjustments[0] = 0.12
    s.fill.solid(); s.fill.fore_color.rgb = fill
    s.line.fill.background()
    s.shadow.inherit = False
    tf = s.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = Inches(0.1); tf.margin_top = Inches(0.06)
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
    r = p.add_run(); r.text = title; r.font.bold = True; r.font.size = Pt(size + 1.5); r.font.color.rgb = TEAL; r.font.name = FONT
    for line in body:
        q = tf.add_paragraph(); q.alignment = PP_ALIGN.LEFT; q.space_before = Pt(2)
        rr = q.add_run(); rr.text = line; rr.font.size = Pt(size); rr.font.color.rgb = INK; rr.font.name = FONT
    return s


# ---------- 1. Title ----------
s = S[0]
tb = label_box(s)
tf = tb.text_frame
vals = ['Sanad (سند): a private front door for men\'s reproductive health', '1 (individual entrant)', 'Fertility · Challenge 01: Male Reproductive Health']
for para, v in zip(tf.paragraphs, vals):
    r = para.add_run(); r.text = v; r.font.name = FONT; r.font.size = Pt(15); r.font.bold = True; r.font.color.rgb = INK
p = tf.add_paragraph(); r = p.add_run(); r.text = f'Live prototype: {URL}  ·  no login needed'; r.font.size = Pt(12); r.font.color.rgb = TEAL; r.font.name = FONT

# ---------- 2. Team members ----------
s = S[1]
t = [sh for sh in s.shapes if sh.has_table][0].table
row = ['Fuad Adegoke', 'Nigeria', 'Team lead: product, clinical-rules research, design and full-stack engineering', 'Independent', 'Confirmed: 18+']
for j, v in enumerate(row):
    c = t.cell(1, j + 1); c.text = v
    for p in c.text_frame.paragraphs:
        for r in p.runs: r.font.size = Pt(9); r.font.name = FONT
for i in range(2, 6):
    for j in range(1, 6):
        t.cell(i, j).text = '—' if j == 1 else ''
        for p in t.cell(i, j).text_frame.paragraphs:
            for r in p.runs: r.font.size = Pt(9); r.font.color.rgb = MUTED

# ---------- 3. Capability ----------
s = S[2]; tighten_label(s)
cap = ("Sanad is built by an independent product engineer and designer based in Lagos who ships consumer health and fintech products end to end: "
       "user research, bilingual UX, front-end, applied cryptography and cloud deployment. Recent work includes GigVault, a payments escrow that won "
       "first place at Busha Build Day 2026, and several products taken from idea to live deployment within days. For Sanad we worked directly from "
       "clinical guidelines (WHO 2021 semen manual, AUA/ASRM 2020/2024, EAU 2024, NICE NG12), wrote the 48 test vignettes and their expected outcomes "
       "before running the engine, and built privacy engineering into version one (on-device processing, client-side AES-256-GCM, no server copy). "
       "Gaps we will close before a pilot: an Abu Dhabi urologist/andrologist and a GP as clinical leads to adjudicate cases and sign off rules, "
       "an Arabic health-literacy reviewer, and a DoH-licensed provider partner for teleconsultation.")
assert len(cap) <= 1000, len(cap)
text(s, L, TOP, Inches(5.6), Inches(3.9), [cap], size=11)
chip(s, Inches(6.15), TOP, Inches(3.5), Inches(1.15), 'Built in the challenge', ['Rules engine (33 rules), bilingual app,', 'share-pack crypto, clinician review,', 'evaluation harness, 8 automated tests'])
chip(s, Inches(6.15), TOP + Inches(1.3), Inches(3.5), Inches(1.15), 'Skills on the team', ['Product & UX design · TypeScript', 'Web Crypto · evaluation design', 'Arabic/English content'])
chip(s, Inches(6.15), TOP + Inches(2.6), Inches(3.5), Inches(1.15), 'Recruiting for pilot', ['Urology/andrology lead · GP lead', 'Health-literacy reviewer (Arabic)', 'Licensed telehealth partner'], fill=RGBColor(0xF3, 0xF0, 0xFA))

# ---------- 4. Architecture ----------
s = S[3]; tighten_label(s)
pic(s, ARCH, Inches(0.3), Inches(1.4), w=Inches(9.4), border=False)

# ---------- 5. Target users ----------
s = S[4]; tighten_label(s)
chip(s, L, TOP, Inches(4.55), Inches(2.35), 'Who it is for', [
    '• Men 18–55 in Abu Dhabi, Emirati and expatriate',
    '• Couples trying 6+ months (12+ if partner under 35)',
    '• Men planning marriage or a family (preconception)',
    '• Men with risk: diabetes, obesity, steroid use,',
    '   outdoor heat work, past testicular problems',
    '• Men who avoid clinics because of stigma or time',
], size=9.5)
chip(s, L, TOP + Inches(2.5), Inches(4.55), Inches(1.4), 'Who acts on it', [
    '• GPs / family medicine, urology & andrology,',
    '   fertility centres, teleconsult providers',
    '• DoH reproductive-health and population-health teams',
], size=9.5, fill=RGBColor(0xF3, 0xF0, 0xFA))
chip(s, Inches(5.05), TOP, Inches(4.62), Inches(3.9), 'Intended outcomes', [
    '1. Men are assessed with their partner, not after her.',
    '2. Modifiable risks (weight, glucose, steroids, smoking,',
    '    heat, medicines) are found before infertility.',
    '3. Red flags (torsion, infection, priapism, lump) reach',
    '    emergency or a 2-week pathway the same day.',
    '4. Fewer unnecessary visits: clear self-care when safe.',
    '5. Clinicians receive a structured, consented summary',
    '    with reasons and sources, ready to act on.',
    '6. A private, stigma-free first step in Arabic or English,',
    '    with a choice of teleconsult, home step or visit,',
    '    and a male-clinician preference passed on.',
], size=9.5, fill=RGBColor(0xEE, 0xF4, 0xF3))

# ---------- 6. Success ----------
s = S[5]; tighten_label(s)
text(s, L, TOP - Inches(0.05), W, Inches(0.3), [('**Prototype results today** (48 simulated vignettes, computed live on the Evidence page)', {'size': 10})])
stats = [('100%', 'red flags sent to\nemergency (6/6)'), ('0', 'under-triaged\ncases'), ('48/48', 'agree with expected\nnext step'), ('0 / 738', 'unsafe results when an\nanswer is removed'), ('Parity', 'same performance across\n5 groups, 4 ages, 2 languages')]
for i, (b, l) in enumerate(stats):
    chip(s, L + Inches(i * 1.88), TOP + Inches(0.3), Inches(1.78), Inches(0.82), b, l.split('\n'), size=8)
rows = [['Pilot measure', 'How we measure it', 'Target (6-month pilot)'],
        ['Completed assessments', 'Opt-in anonymous tally: started → completed', '≥ 70% completion'],
        ['Time to appropriate evaluation', 'Check date → clinician decision date (audit log)', 'Median < 30 days'],
        ['Referral completion', 'Share packs opened by a clinician ÷ packs created', '≥ 60%'],
        ['Clinical safety', 'Clinician agree/override with reasons; under-triage review', '≥ 85% agreement, 0 unsafe under-triage'],
        ['User trust', '3-item in-app check: clear · private · would recommend', '≥ 80% "yes"'],
        ['Fairness', 'All of the above by age band, language, nationality group', 'No gap > 10 points; small cells suppressed']]
table(s, L, TOP + Inches(1.28), W, rows, [2.1, 4.24, 3.0], size=8.5, rowh=0.36)

# ---------- 7. Evidence ----------
s = S[6]; tighten_label(s)
ev = [
    ('**Why men need an earlier front door**', {'size': 11.5}),
    ('A male factor contributes to about half of infertile couples, yet men are often assessed late (Agarwal et al., Reprod Biol Endocrinol 2015).', {'bullet': True, 'size': 10}),
    ('Guidelines advise evaluating the male partner at the same time as the female partner (AUA/ASRM Male Infertility Guideline 2020, amended 2024).', {'bullet': True, 'size': 10}),
    ('Male infertility is linked to wider health risks, including testicular cancer and higher mortality (Eisenberg et al., Hum Reprod 2014; EAU SRH 2024).', {'bullet': True, 'size': 10}),
    ('Stigma and masculinity norms delay help-seeking (Hanna & Gough, review of qualitative research, 2015).', {'bullet': True, 'size': 10}),
    ('**Why these signals and thresholds**', {'size': 11.5}),
    ('Semen reference limits: WHO Laboratory Manual, 6th ed. (2021). Hypogonadism threshold and FSH: EAU SRH 2024.', {'bullet': True, 'size': 10}),
    ('Obesity lowers sperm counts (Sermondade et al., Hum Reprod Update 2013); smoking lowers count and motility (Sharma et al., Eur Urol 2016).', {'bullet': True, 'size': 10}),
    ('Testosterone and anabolic steroids suppress sperm production; recovery takes months (AUA/ASRM 2020; Liu et al., Lancet 2006).', {'bullet': True, 'size': 10}),
    ('Erectile dysfunction is an early marker of cardiovascular disease (Princeton III Consensus, Mayo Clin Proc 2012).', {'bullet': True, 'size': 10}),
    ('Heat exposure impairs spermatogenesis (Durairajanayagam et al., Reprod Biomed Online 2015). Testicular lump: 2-week pathway (NICE NG12).', {'bullet': True, 'size': 10}),
    ('**Our own testing**', {'size': 11.5}),
    ('48 vignettes labelled from guidelines before running; edge-case review found one under-triage in v1.2 (unknown partner age), fixed in v1.3. Because labels and rules share sources, this proves faithful implementation, not clinical accuracy: independent clinician adjudication is pilot milestone 1.', {'bullet': True, 'size': 10}),
]
text(s, L, TOP, W, Inches(3.95), ev)

# ---------- 8. Data ----------
s = S[7]; tighten_label(s)
rows = [['Source', 'Type', 'Owner', 'Sensitivity', 'Permission / legal basis', 'Personal data?'],
        ['Answers entered by the user', 'Self-report', 'The user', 'High (reproductive health)', 'Explicit in-app consent; processed on the device only', 'Yes, but no identifiers; never leaves the device unless the user shares'],
        ['Share pack', 'Encrypted subset chosen by user', 'The user', 'High', 'User selects fields; PIN-encrypted; expires 24 h / 7 d', 'Yes, user-selected; no server copy'],
        ['48 test vignettes', 'Synthetic cases', 'Team', 'None', 'Own work', 'No'],
        ['Clinical thresholds', 'Published guidelines (WHO, AUA/ASRM, EAU, NICE)', 'Publishers', 'Public', 'Cited facts and thresholds; no text reproduced', 'No'],
        ['Usage tally', 'Aggregate counts', 'Service operator', 'Low', 'Opt-in, off by default', 'No'],
        ['Clinician audit log', 'Review decisions', 'Provider', 'Medium', "Provider's own clinical record", 'Reviewer label only']]
table(s, L, TOP, W, rows, [1.6, 1.55, 0.95, 1.2, 2.1, 1.94], size=8, rowh=0.42)
text(s, L, TOP + Inches(3.05), W, Inches(0.8), [('No organiser data and no real patient data were used. Sanad never asks for name, Emirates ID, phone, location, nationality, religion or marital status. Designed for UAE PDPL (Federal Decree-Law 45/2021), Federal Law 2/2019 on ICT in health fields, and DoH Abu Dhabi data standards; a pilot backend would be hosted in-country.', {'size': 8.5, 'color': MUTED})])

# ---------- 9. Risks ----------
s = S[8]; tighten_label(s)
rows = [['Risk', 'Safeguard built in the prototype'],
        ['Privacy', 'No account or identifiers; answers in session storage only; "Delete my data" on every page; granular consent; nothing on a server.'],
        ['Security', 'Share pack: AES-256-GCM, key from PBKDF2-SHA256 (210k iterations) with a 6-digit PIN told separately; data in URL fragment (never sent to servers); expiry; no-referrer policy.'],
        ['Bias', 'No protected attributes are read (tested); performance checked by nationality group, age band and language; pilot fairness metrics with small-cell suppression.'],
        ['Explainability', 'Every signal shows a plain-language reason, the source guideline and its rule ID; versioned engine; full rule trace for clinicians.'],
        ['Misuse', 'Explicit ban on use by employers, insurers, sponsors or family; screening, not diagnosis, stated on every screen; "never stop a medicine on your own".'],
        ['Human oversight', 'Clinician opens the pack, confirms or overrides; a reason is required to override; audit log records engine version and decision.'],
        ['Failure modes', 'Red flags evaluated first and never suppressed; "not sure" on a red flag is never treated as "no"; missing answers cannot lower urgency (0/738 unsafe in tests); completeness shown to the user.']]
table(s, L, TOP, W, rows, [1.45, 7.89], size=8.5, rowh=0.46)

# ---------- 10. Hardware ----------
s = S[9]; tighten_label(s)
text(s, L, TOP + Inches(0.1), W, Inches(2), [
    ('**Not applicable: Sanad is software only.**', {'size': 12}),
    ('It runs in any modern browser on a phone or computer, with no install and no special hardware.', {'size': 11}),
    ('Where Sanad suggests an at-home step (for example a home sperm-concentration test), it points the user to regulator-cleared products and explains their limits; it does not supply or connect to devices. A future kit partnership would use only devices approved for the UAE market.', {'size': 11}),
])

# ---------- 11. Login ----------
s = S[10]; tighten_label(s)
text(s, L, TOP + Inches(0.05), W, Inches(3.8), [
    ('**No login is needed. Everything works as a guest.**', {'size': 12.5}),
    (f'Prototype: {URL}', {'size': 11.5, 'color': TEAL}),
    ('**Try the user journey**', {'size': 11}),
    ('Start private check → accept consent → answer (or skip) questions → see the next step → "Share with a clinician" to create an encrypted link and PIN.', {'bullet': True, 'size': 10}),
    ('Answer "Yes" to the first safety question to see the emergency stop screen.', {'bullet': True, 'size': 10}),
    ('Switch to Arabic with the العربية button (full right-to-left layout).', {'bullet': True, 'size': 10}),
    ('**Try the clinician view**', {'size': 11}),
    ('Clinician view → "Load a demo pack". The demo PIN 246810 is filled in for you. Open the pack, then confirm or override and see the audit log.', {'bullet': True, 'size': 10}),
    ('**See the evidence**', {'size': 11}),
    ('Evidence & testing page: all 48 vignettes, confusion matrix and fairness tables, computed live from the same engine.', {'bullet': True, 'size': 10}),
])

# ---------- 12. Pilot ----------
s = S[11]; tighten_label(s)
chip(s, L, TOP, Inches(3.0), Inches(1.9), 'Stakeholders', ['DoH Abu Dhabi reproductive-health', 'programme · primary care networks', '· fertility centres · urology/andrology', '· licensed telehealth providers', '· payers (as funders, never data users)'], size=8.5)
chip(s, L + Inches(3.13), TOP, Inches(3.0), Inches(1.9), 'Integration', ['Share pack → FHIR Questionnaire-', 'Response + ServiceRequest to', 'Malaffi (Abu Dhabi HIE) · teleconsult', 'deep links · lab booking for semen', 'analysis and morning hormones'], size=8.5)
chip(s, L + Inches(6.26), TOP, Inches(3.08), Inches(1.9), 'Regulatory', ['DoH AI and digital-health policies', '· UAE PDPL · Federal Law 2/2019', '(in-country health data) · medical-', 'device classification of triage', 'software; clinical-safety case'], size=8.5)
rows = [['Months', 'Milestone'],
        ['0–2', 'Clinical governance: urology + GP leads adjudicate vignettes, sign off rules v2; Arabic content review; safety case'],
        ['2–3', 'Usability with 30 men in Arabic and English (completion, comprehension, trust)'],
        ['3–9', 'Pilot in 2 primary-care sites + 1 fertility centre (target n≈500): referral completion, time to evaluation, fairness'],
        ['9–12', 'Malaffi integration, evaluation report, scale to the Emirate']]
table(s, L, TOP + Inches(2.02), Inches(6.15), rows, [0.7, 5.45], size=8, rowh=0.32)
chip(s, L + Inches(6.26), TOP + Inches(2.02), Inches(3.08), Inches(1.6), 'Sustainability', ['Licence to providers and payers per', 'completed assessment or referral;', 'very low running cost (static app,', 'no health data hosting); rules', 'updated with guideline releases'], size=8.5, fill=RGBColor(0xEE, 0xF4, 0xF3))

# ---------- 13. IP ----------
s = S[12]; tighten_label(s)
rows = [['Component', 'Owner / licence', 'Restrictions'],
        ['Sanad source code, rules, Arabic/English content, vignettes, designs', 'The team (original work created for this challenge)', 'None'],
        ['Vite, Vitest', 'MIT licence', 'Attribution in notices'],
        ['TypeScript', 'Apache-2.0', 'Attribution in notices'],
        ['qrcode (npm)', 'MIT licence', 'Attribution in notices'],
        ['IBM Plex Sans / Sans Arabic / Mono fonts', 'SIL Open Font Licence 1.1', 'None for web use'],
        ['Clinical guidelines (WHO, AUA/ASRM, EAU, NICE)', 'Their publishers', 'Cited as sources; thresholds used as facts; no text reproduced'],
        ['Hosting', 'Vercel (static hosting service)', 'Replaceable; no lock-in']]
table(s, L, TOP, W, rows, [3.6, 3.3, 2.44], size=8.5, rowh=0.38)
text(s, L, TOP + Inches(3.2), W, Inches(0.5), [('No proprietary datasets, models or third-party clinical content were used.', {'size': 9, 'color': MUTED})])

# ---------- 14. COI ----------
s = S[13]; tighten_label(s)
text(s, L, TOP + Inches(0.1), W, Inches(1.5), [
    ('**None.**', {'size': 14}),
    ('No team member is employed by or contracted to the Department of Health – Abu Dhabi, Future Health, Microsoft, Inception42, MBZUAI or Hack2skill; has a family or close relationship with a judge, organiser or collaborator; holds a financial interest in an organisation running or judging the challenge; or has had access to non-public information about the challenge or its evaluation.', {'size': 11}),
])

# ---------- 15. Additional: screens ----------
s = S[14]
lb = label_box(s); lb.top = Inches(0.78); lb.height = Inches(0.5)
lb.text_frame.paragraphs[0].runs[0].text = 'Additional slide: screens from the live prototype'
shots = [('c-05-result.jpg', 'Result: next step, reasons and sources'), ('c-10-result-ar.jpg', 'Full Arabic, right-to-left'), ('c-07-clinician.jpg', 'Clinician review and audit log'), ('c-08-evidence.jpg', 'Live evidence page')]
cw = Inches(2.27)
for i, (f, cap) in enumerate(shots):
    x = L + i * (cw + Inches(0.09))
    pic(s, f'{SHOTS}/{f}', x, Inches(1.35), w=cw)
    text(s, x, Inches(1.35) + int(cw * 0.625) + Inches(0.05), cw, Inches(0.3), [(cap, {'size': 8, 'color': MUTED})])
pic(s, f'{SHOTS}/c-12-urgent-ar.jpg', L, Inches(3.25), h=Inches(1.6))
pic(s, f'{SHOTS}/c-01-home.jpg', L + Inches(2.85), Inches(3.25), h=Inches(1.6))
text(s, L + Inches(5.85), Inches(3.25), Inches(3.5), Inches(1.6), [
    ('**Six asks, six answers**', {'size': 10}),
    ('1 Explainable signals, screening ≠ diagnosis', {'size': 8.5}),
    ('2 Arabic/English, no assumptions about family', {'size': 8.5}),
    ('3 4-minute private intake, teleconsult/home step', {'size': 8.5}),
    ('4 Five care levels, red flags first, clinician override', {'size': 8.5}),
    ('5 Consent, minimal data, encrypted user-chosen sharing', {'size': 8.5}),
    ('6 48 cases, fairness tables, pilot metrics', {'size': 8.5}),
])
for sh in s.shapes:
    if sh.shape_type == 13 and sh.width == cw:
        pass

prs.save(OUT)
print('saved', OUT)
