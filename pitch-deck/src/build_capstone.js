// Builds pitch-deck/capstone/VentureX_Capstone_Deck.pptx (rebuild, Nov 2026).
// 11 slides, dark graphite identity inspired by Linear's design philosophy, original VentureX branding.
//   cd pitch-deck/src && node build_capstone.js           all slides
//   VX_ONLY=1,2,9 node build_capstone.js                    only some slides (design review)
// Every slide carries a headline, one composed visual and real product screenshots where useful;
// the detail, sources and caveats live in the speaker notes. Facts are verified against the code.
// The earlier version is kept in build_capstone_previous.js (writes to capstone/previous/).
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require("./apply_theme.js");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "capstone");
const SHOT = (f) => path.join(ROOT, "assets", "screens_v2", f);
const ART = (f) => path.join(OUT_DIR, "assets", f);
const OUT = process.env.VX_OUT || path.join(OUT_DIR, "VentureX_Capstone_Deck.pptx");
const ONLY = (process.env.VX_ONLY || "").split(",").filter(Boolean).map(Number);
const want = (n) => !ONLY.length || ONLY.includes(n);

// Verified figures (24 Nov 2026): latest full pytest run, e2e runs, route decorators, schema.sql.
const F = { backendTests: 120, browserSuites: 7, apiFlowChecks: 89, endpoints: 143, routeModules: 15, tables: 29 };

// ---------- design system ----------
// Colours match the VentureX app: warm off-white content slides, deep navy (the app's sidebar)
// for the cover and closing slides, the app's blue as the main accent and a muted gold, used
// sparingly, for the investor side and key figures. Names: indigo = primary accent, violet = secondary.
const LIGHT = {
  bg: "F7F5F0", s1: "FFFFFF", s2: "F1EEE7", line: "E6E1D7", line2: "D5CEC1",
  text: "14213D", muted: "5B6475", dim: "8C919B",
  indigo: "1E4B8F", violet: "B8862B", green: "2E8B57", onAccent: "FFFFFF", shadow: 0.12,
};
const DARK = {
  bg: "0F1B33", s1: "16264A", s2: "1C2E55", line: "2A3B60", line2: "3A4D75",
  text: "F5F3EE", muted: "B4BDCC", dim: "8592A8",
  indigo: "8FB1F0", violet: "D9B25F", green: "5FC896", onAccent: "0F1B33", shadow: 0.45,
};
const K = { ...LIGHT };
const usePalette = (p) => Object.assign(K, p);
const THEME = {
  name: "VentureX", headFontFace: "Newsreader Medium", bodyFontFace: "Inter",
  colors: { dk1: K.bg, lt1: K.text, dk2: K.s1, lt2: K.muted, accent1: K.indigo, accent2: K.violet, accent3: K.green,
    accent4: K.line2, accent5: K.s2, accent6: K.dim, hlink: K.violet, folHlink: K.muted },
};
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.author = "Anshitha Yeruva, Nitya Nara";
pres.title = "VentureX: AI-powered startup readiness and investor matching";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
// Same type as the website (frontend/app/globals.css): Newsreader for titles and key figures, Inter for the rest.
const SERIF = "Newsreader Medium", SANS = "Inter";
const W = 13.333, CX = 1.3, R = W - 0.7, CWv = R - CX, MID = CX + CWv / 2;

const brand = [{ text: { text: "VentureX", options: { x: R - 2, y: 7.0, w: 2, h: 0.22, fontSize: 9, bold: true, color: K.dim, align: "right", margin: 0 } } }];
pres.defineSlideMaster({ title: "VX Plain", background: { color: K.bg }, objects: brand });
pres.defineSlideMaster({ title: "VX Soft", background: { color: LIGHT.bg }, objects: brand });
pres.defineSlideMaster({ title: "VX Cover", background: { path: ART("v3_cover.png") }, objects: [] });
pres.defineSlideMaster({ title: "VX Close", background: { path: ART("v3_close.png") }, objects: [] });

// ---------- helpers ----------
const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, fontSize: 14, color: K.text, valign: "top", fontFace: SANS, ...o });
const rect = (s, o) => s.addShape(pres.shapes.RECTANGLE, { line: { type: "none" }, ...o });
const rr = (s, o) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { rectRadius: 0.06, line: { type: "none" }, ...o });
const box = (s, x, y, w, h, o = {}) => rr(s, { x, y, w, h, rectRadius: o.r ?? 0.06, fill: { color: o.fill || K.s1 }, line: { color: o.border || K.line2, width: o.bw || 0.75 }, shadow: o.shadow });
const dot = (s, cx, cy, d, o) => s.addShape(pres.shapes.OVAL, { x: cx - d / 2, y: cy - d / 2, w: d, h: d, line: { type: "none" }, ...o });
const ln = (s, x1, y1, x2, y2, o = {}) => {
  const line = { color: o.color || K.line2, width: o.width || 1 };
  if (o.dash) line.dashType = o.dash;
  if (o.arrow || o.both) line.endArrowType = "triangle";
  if (o.both) line.beginArrowType = "triangle";
  s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, line });
};
const shadow = () => ({ type: "outer", color: "000000", opacity: K.shadow, blur: 18, offset: 6, angle: 90 });
// Section rail on the left: slide number on top, section name running up the rail.
const rail = (s, n, label) => {
  T(s, n, { x: 0.6, y: 0.5, w: 0.5, h: 0.25, fontSize: 10, bold: true, color: K.indigo, align: "center" });
  ln(s, 0.85, 0.9, 0.85, 2.3, { color: K.line, width: 0.75 });
  ln(s, 0.85, 5.5, 0.85, 6.95, { color: K.line, width: 0.75 });
  T(s, label, { x: 0.85 - 1.55, y: 3.9 - 0.14, w: 3.1, h: 0.28, fontSize: 9, bold: true, color: K.dim, charSpacing: 3, align: "center", valign: "middle", rotate: 270 });
};
const head = (s, text, o = {}) => T(s, text, { x: CX, y: 0.5, w: o.w || CWv, h: 1.1, fontSize: o.size || 32, fontFace: SERIF });
const slide = (master = "VX Plain") => { usePalette(master === "VX Cover" || master === "VX Close" ? DARK : LIGHT); return pres.addSlide({ masterName: master }); };
// Real screenshot in a thin app-window frame.
const shot = (s, file, pw, ph, x, y, w, name) => {
  const h = (w * ph) / pw, bar = 0.22;
  rr(s, { x, y, w, h: h + bar, rectRadius: 0.05, fill: { color: K.s2 }, line: { color: K.line2, width: 0.75 }, shadow: shadow() });
  [0, 1, 2].forEach((i) => dot(s, x + 0.16 + i * 0.12, y + bar / 2, 0.065, { fill: { color: K.line2 } }));
  s.addImage({ path: SHOT(file), x, y: y + bar, w, h, altText: name, objectName: name });
  return { x, y: y + bar, w, h, bottom: y + bar + h, right: x + w };
};
const marker = (s, letter, px, py) => {
  dot(s, px, py, 0.46, { fill: { color: K.indigo, transparency: 70 } });
  dot(s, px, py, 0.3, { fill: { color: K.indigo }, line: { color: "FFFFFF", width: 1.25 } });
  T(s, letter, { x: px - 0.15, y: py - 0.15, w: 0.3, h: 0.3, fontSize: 11, bold: true, color: K.onAccent, align: "center", valign: "middle" });
};
const keyItem = (s, letter, text, x, y, w) => {
  dot(s, x + 0.14, y + 0.14, 0.28, { fill: { color: K.indigo } });
  T(s, letter, { x, y, w: 0.28, h: 0.28, fontSize: 10, bold: true, color: K.onAccent, align: "center", valign: "middle" });
  T(s, text, { x: x + 0.4, y, w, h: 0.28, fontSize: 13, color: K.muted, valign: "middle" });
};
const pill = (s, text, x, y, w, o = {}) => {
  const h = o.h || 0.4;
  rr(s, { x, y, w, h, rectRadius: h / 2, fill: { color: o.fill || K.s2 }, line: { color: o.border || K.line2, width: o.bw || 0.75 } });
  T(s, text, { x, y, w, h, fontSize: o.size || 13, bold: !!o.bold, color: o.color || K.text, align: "center", valign: "middle" });
};
const mark = (s, x, y, size = 0.34) => {
  rr(s, { x, y, w: size, h: size, rectRadius: 0.07, fill: { type: "none" }, line: { color: K.violet, width: 1.5 } });
  rr(s, { x: x + size * 0.45, y: y + size * 0.45, w: size, h: size, rectRadius: 0.07, fill: { color: K.indigo } });
};
// Horizontal stepper: nodes on a rail with labels underneath.
const hsteps = (s, steps, x0, x1, y, o = {}) => {
  const n = steps.length, gap = (x1 - x0) / n;
  ln(s, x0 + gap / 2, y + 0.16, x1 - gap / 2, y + 0.16, { color: K.line2, width: 1.25 });
  steps.forEach((t, i) => {
    const cx = x0 + gap / 2 + i * gap, last = i === n - 1;
    dot(s, cx, y + 0.16, 0.32, { fill: { color: last ? K.indigo : K.bg }, line: { color: last ? K.indigo : K.line2, width: 1.25 } });
    T(s, String(i + 1), { x: cx - 0.16, y, w: 0.32, h: 0.32, fontSize: 10, bold: true, color: last ? K.onAccent : K.muted, align: "center", valign: "middle" });
    T(s, t, { x: cx - gap / 2 + 0.05, y: y + 0.42, w: gap - 0.1, h: 0.5, fontSize: o.size || 13, color: last ? K.text : K.muted, bold: last, align: "center" });
  });
};

// =====================================================================
// 01. INTRODUCING VENTUREX
// =====================================================================
if (want(1)) {
  const s = slide("VX Cover");
  mark(s, 0.8, 0.85);
  T(s, "VentureX", { x: 1.45, y: 0.86, w: 4, h: 0.45, fontSize: 24, fontFace: SERIF, valign: "middle" });
  T(s, [{ text: "Get investor-ready.", options: { breakLine: true } }, { text: "Meet investors who fit.", options: { color: K.indigo } }],
    { x: 0.8, y: 2.2, w: 7.0, h: 1.8, fontSize: 44, fontFace: SERIF });
  T(s, "AI-powered startup readiness and investor matching platform", { x: 0.8, y: 4.2, w: 6.95, h: 0.35, fontSize: 16, color: K.muted });
  T(s, "Anshitha Yeruva  |  Nitya Nara", { x: 0.8, y: 6.45, w: 6, h: 0.3, fontSize: 13, color: K.dim });
  // The ecosystem, told with real product: a founder's private readiness, an investor that fits, and why.
  const lab = (t, x, y, w, al = "left") => T(s, t, { x, y, w, h: 0.2, fontSize: 9, bold: true, color: K.muted, charSpacing: 2, align: al });
  lab("FOUNDER  ·  PRIVATE READINESS", 7.95, 1.0, 4.6);
  const a = shot(s, "snip_readiness.png", 2090, 165, 7.95, 1.25, 4.6, "Readiness score (real screen, demo data)");
  lab("INVESTOR  ·  RANKED BY FIT", 9.63, 1.98, 3.0, "right");
  const b = shot(s, "snip_investor_card.png", 1070, 678, 9.63, 2.22, 3.0, "Investor card with fit (real screen, demo data)");
  lab("WHY IT FITS", 7.75, 4.38, 4.6);
  const c = shot(s, "snip_reasons.png", 1280, 327, 7.75, 4.62, 4.6, "Fit reasons (real screen, demo data)");
  ln(s, 8.35, a.bottom, 8.35, c.y - 0.45, { color: K.indigo, width: 1.25 });
  ln(s, 8.35, b.y + b.h * 0.55, b.x, b.y + b.h * 0.55, { color: K.indigo, width: 1.25 });
  dot(s, 8.35, b.y + b.h * 0.55, 0.14, { fill: { color: K.indigo } });
  s.addNotes(
    "VentureX is an AI-powered startup readiness and investor matching platform, built as our capstone by Anshitha Yeruva and Nitya Nara.\n" +
    "The composition on the right is made of real pieces of the product (demo data): a founder's private readiness score, an investor ranked by fit for that startup, and the reasons the startup fits the investor's thesis. That is the whole idea in one picture.\n" +
    "Over the next ten slides: the problem, our solution, both user experiences, the readiness report, explainable matching, what makes it different, the architecture and the engineering behind it. Then we show it live."
  );
}

// =====================================================================
// 02. THE PROBLEM
// =====================================================================
if (want(2)) {
  const s = slide();
  rail(s, "01", "THE PROBLEM");
  head(s, "Finding the right investor shouldn't be harder than building the startup.", { w: 10.6 });
  const rows = [2.75, 3.5, 4.25], colW = 4.6;
  const sides = [
    { label: "FOUNDERS", x: CX, al: "left", qs: ["Who should I pitch?", "Is my startup ready?", "Why am I not getting responses?"], col: K.indigo },
    { label: "INVESTORS", x: R - colW, al: "right", qs: ["Which startups fit my thesis?", "How do I screen opportunities?", "How do I avoid wasting time?"], col: K.violet },
  ];
  const gapL = 6.6, gapR = 7.35, cy = 3.55;
  sides.forEach((sd, k) => {
    T(s, sd.label, { x: sd.x, y: 2.15, w: colW, h: 0.24, fontSize: 11, bold: true, color: sd.col, charSpacing: 3, align: sd.al });
    const dx = k ? R - 0.1 : CX + 0.1;
    ln(s, dx, rows[0] + 0.18, dx, rows[2] + 0.18, { color: K.line2, width: 1, dash: "dash" });
    sd.qs.forEach((q, i) => {
      dot(s, dx, rows[i] + 0.18, 0.16, { fill: { color: sd.col } });
      T(s, q, { x: k ? sd.x : CX + 0.4, y: rows[i], w: colW - 0.4, h: 0.36, fontSize: 18, align: sd.al, valign: "middle" });
      // each question heads toward the middle ... and stops short
      if (k) ln(s, R - colW - 0.05, rows[i] + 0.18, gapR, cy, { color: K.line2, width: 1 });
      else ln(s, CX + colW + 0.05, rows[i] + 0.18, gapL, cy, { color: K.line2, width: 1 });
    });
  });
  dot(s, gapL, cy, 0.12, { fill: { color: K.indigo } });
  dot(s, gapR, cy, 0.12, { fill: { color: K.violet } });
  T(s, "×", { x: (gapL + gapR) / 2 - 0.2, y: cy - 0.22, w: 0.4, h: 0.4, fontSize: 18, bold: true, color: K.dim, align: "center", valign: "middle" });
  T(s, "no shared signal", { x: (gapL + gapR) / 2 - 1, y: cy + 0.25, w: 2, h: 0.22, fontSize: 10, color: K.dim, align: "center" });
  // verified context
  ln(s, CX, 5.25, R, 5.25, { color: K.line, width: 0.75 });
  const stats = [["2,07,135", "DPIIT-recognised startups"], ["1,518", "tech funding rounds in 2025"], ["53%", "fewer investors in 2025 rounds"]];
  stats.forEach(([n, l], i) => {
    const x = CX + i * (CWv / 3);
    T(s, n, { x, y: 5.45, w: 3.5, h: 0.5, fontSize: 32, fontFace: SERIF, color: i ? K.violet : K.text, valign: "middle" });
    T(s, l, { x, y: 5.98, w: 3.5, h: 0.26, fontSize: 12, color: K.muted });
  });
  T(s, "Sources: Ministry of Commerce & Industry, as of 31 Dec 2025 (via The Tribune); Tracxn India Tech 2025 (via TechCrunch, 27 Dec 2025). Separate datasets.",
    { x: CX, y: 6.55, w: CWv - 1.6, h: 0.22, fontSize: 8.5, color: K.dim });
  s.addNotes(
    "Both sides of fundraising ask questions the other side could answer, but there is no shared signal between them.\n" +
    "Founders: investor research is manual, one list and one cold email at a time. Stage, sector and cheque size are rarely clear up front. They can't tell whether the deck, market sizing or traction is good enough, and rejections rarely say what was missing.\n" +
    "Investors: most inbound pitches fall outside the thesis; every startup describes itself differently; screening takes partner time before any real conversation.\n" +
    "Context: 2,07,135 DPIIT-recognised startups as of 31 Dec 2025 (Ministry of Commerce & Industry, via The Tribune). Tracxn 2025 India Tech (via TechCrunch, 27 Dec 2025): 1,518 funding rounds (down about 39%), roughly 3,170 investors took part in rounds (down 53% from about 6,800), seed funding $1.1B (down 30%). Separate datasets: don't divide one by the other. Capital is getting more selective, so finding the right fit matters more."
  );
}

// =====================================================================
// 02b. FIELD EVIDENCE (rubric A2). Quotes are verbatim from the team's August 2026 chats.
// =====================================================================
if (want(24)) {
  const s = slide();
  rail(s, "02", "FIELD EVIDENCE");
  head(s, "We spoke to five people. Here's what they told us.");
  const people = [
    ["Student founder", "building a side project", "There's no proper place where I can find investors who are actually interested in my type of idea."],
    ["First-time founder", "student", "I don't want to embarrass myself by pitching too early."],
    ["Founder who raised", "pitched investors", "A few said they weren't interested, but most didn't explain why."],
    ["Incubator / E-Cell", "ecosystem", "There's no centralized system where students can continuously discover relevant investors."],
    ["Angel / VC analyst", "investor side", "Many pitches aren't relevant to our investment focus."],
  ];
  const lw = 7.15, rowH = 0.86;
  people.forEach(([role, sub, quote], i) => {
    const y = 1.72 + i * rowH;
    if (i) ln(s, CX, y - 0.06, CX + lw, y - 0.06, { color: K.line, width: 0.75 });
    const col = i === 4 ? K.violet : i === 3 ? K.muted : K.indigo;
    T(s, role, { x: CX, y: y + 0.04, w: 2.1, h: 0.3, fontSize: 13, bold: true, color: col });
    T(s, sub, { x: CX, y: y + 0.36, w: 2.1, h: 0.26, fontSize: 11, color: K.dim });
    T(s, "“" + quote + "”", { x: CX + 2.25, y, w: lw - 2.25, h: rowH - 0.12, fontSize: 15, fontFace: SERIF, valign: "middle" });
  });
  // what we heard
  const rx = CX + lw + 0.55, rw = R - rx;
  T(s, "WHAT WE HEARD", { x: rx, y: 1.72, w: 3, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2 });
  const themes = [["3 of 5", "didn't know which investors fit them"], ["3 of 5", "didn't know if a startup was ready to pitch"], ["The founder who raised", "got rejections with no reason"], ["The investor", "loses time on pitches outside their focus"]];
  themes.forEach(([n, t], i) => {
    const y = 2.08 + i * 0.86;
    T(s, n, { x: rx, y, w: rw, h: 0.36, fontSize: i < 2 ? 22 : 15, fontFace: SERIF, color: i < 2 ? K.indigo : K.violet, valign: "bottom" });
    T(s, t, { x: rx, y: y + 0.38, w: rw, h: 0.4, fontSize: 13, color: K.text });
  });
  box(s, CX, 6.15, CWv, 0.5, { fill: K.s2 });
  T(s, [{ text: "Limits:  ", options: { bold: true } }, { text: "five people, all from our own network, August 2026. Next: investors outside our network.", options: { color: K.muted } }],
    { x: CX + 0.25, y: 6.15, w: CWv - 0.5, h: 0.5, fontSize: 13, valign: "middle" });
  s.addNotes(
    "Rubric A2: who we spoke to and what they said. These are from our chats in August 2026; keep the original chats ready to show if the panel asks for our notes.\n" +
    "1. Student founder (building a side project): searches LinkedIn, Google and Instagram and asks seniors; doesn't know what stage investors expect (prototype, customers, revenue or just a presentation); would rather contact five interested investors than message a hundred.\n" +
    "2. First-time student founder: finds too many investors across sectors and can't tell who's suitable; wants guidance like 'you're early, validate your market first'; would create a profile once, upload a deck and see matching investors.\n" +
    "3. Founder who has tried raising: the hard part was getting anyone to look at the deck; researching each investor's past deals, sectors and stage took a long time; wanted to know why an investor matches before contacting them, and a reason when rejected.\n" +
    "4. Incubator / E-Cell coordinator: many students haven't researched the market, built a prototype or spoken to customers; connections to investors depend on personal networks, events and WhatsApp groups; investor-ready means a clear problem, validated solution, market understanding, a capable team and a realistic business model.\n" +
    "5. Angel investor / VC analyst: pitches arrive by email, LinkedIn, referrals and events, and many miss their focus; they screen on sector, problem, market, team, stage and traction; market validation and financial assumptions are often missing; they would use a dashboard filtering by sector, stage, location and traction, if the information is reliable.\n" +
    "How this shaped VentureX: the readiness report answers 'am I ready?' (1, 2, 4); fit scores with reasons answer 'who fits me, and why?' (1, 2, 3); investor criteria and Discover answer the investor's time problem (5); the incubator's investor-ready checklist maps closely to our five readiness dimensions.\n" +
    "Be honest if asked: nobody disagreed outright, and all five came from our own network, so the sample is small and friendly. Our next step is to speak to investors we don't know."
  );
}

// =====================================================================
// 03. OUR SOLUTION
// =====================================================================
if (want(3)) {
  const s = slide();
  rail(s, "03", "THE SOLUTION");
  head(s, "One intelligent platform connecting both sides of fundraising.", { w: 10.6 });
  const node = (y, text, w, o = {}) => pill(s, text, MID - w / 2, y, w, { h: 0.44, ...o });
  node(2.05, "Founder", 2.0, { bold: true, border: K.indigo, size: 14 });
  node(2.72, "Startup profile  ·  pitch deck  ·  documents  ·  GitHub", 6.0, { color: K.muted });
  const pw = 6.6, px = MID - pw / 2, py = 3.42, ph = 1.62;
  box(s, px, py, pw, ph, { fill: K.s1, border: K.indigo, bw: 1.25, shadow: shadow() });
  T(s, "VENTUREX INTELLIGENCE", { x: px + 0.25, y: py + 0.16, w: 4, h: 0.22, fontSize: 10, bold: true, color: K.violet, charSpacing: 3 });
  const mods = [["AI Readiness", "private report"], ["Explainable Matching", "fit + reasons"], ["Discovery", "both directions"], ["Deal Room", "chat · NDA · files"]];
  const mw = (pw - 0.5 - 3 * 0.14) / 4;
  mods.forEach(([a, b], i) => {
    const x = px + 0.25 + i * (mw + 0.14);
    box(s, x, py + 0.5, mw, 0.9, { fill: K.s2 });
    T(s, a, { x: x + 0.08, y: py + 0.56, w: mw - 0.16, h: 0.46, fontSize: 12, bold: true, align: "center", valign: "middle" });
    T(s, b, { x: x + 0.08, y: py + 1.02, w: mw - 0.16, h: 0.26, fontSize: 10, color: K.muted, align: "center", valign: "middle" });
  });
  node(5.3, "Investment thesis  ·  priorities  ·  cheque size  ·  geography", 6.0, { color: K.muted });
  node(5.97, "Investor", 2.0, { bold: true, border: K.violet, size: 14 });
  [[2.49, 2.72], [3.16, 3.42], [5.04, 5.3], [5.74, 5.97]].forEach(([a, b]) => ln(s, MID, a, MID, b, { color: K.indigo, width: 1.25, both: true }));
  const side = (x, al, headTxt, lines) => {
    T(s, headTxt, { x, y: 3.55, w: 2.25, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2, align: al });
    lines.forEach((l, i) => T(s, l, { x, y: 3.9 + i * 0.38, w: 2.25, h: 0.3, fontSize: 14, align: al }));
  };
  side(CX, "left", "FOUNDERS GET", ["Readiness report", "Ranked investors"]);
  side(R - 2.25, "right", "INVESTORS GET", ["Ranked startups", "Reasons per criterion"]);
  ln(s, CX + 2.3, 4.25, px - 0.08, 4.25, { color: K.line2, width: 0.75, dash: "dash" });
  ln(s, px + pw + 0.08, 4.25, R - 2.3, 4.25, { color: K.line2, width: 0.75, dash: "dash" });
  s.addNotes(
    "VentureX sits between the two sides and works in both directions.\n" +
    "Founders bring a startup profile, pitch deck and documents (PDF, PPTX, DOCX and more), plus an optional public GitHub repository and demo link. Investors bring an investment thesis: sectors, stages, cheque size, geography, traction and team requirements, and how much each criterion matters.\n" +
    "The intelligence layer has four connected parts: (1) AI readiness, a private report for the founder; (2) explainable matching, a fit score with a reason for every criterion; (3) discovery in both directions, so founders find investors and investors find startups; (4) the deal room, a private space with chat, NDA, shared documents, deal stage and funding round.\n" +
    "The same fit is shown to founders on Find investors and to investors on Discover."
  );
}

// =====================================================================
// 04. THE FOUNDER EXPERIENCE
// =====================================================================
if (want(4)) {
  const s = slide();
  rail(s, "04", "FOUNDERS");
  head(s, "From uncertainty to investor readiness.");
  hsteps(s, ["Register", "Build startup profile", "Upload deck and materials", "Evaluate readiness", "Discover relevant investors", "Request connections"], CX, R, 1.5);
  const a = shot(s, "founder_dashboard.png", 2880, 920, CX, 2.85, 5.45, "Founder dashboard");
  const b = shot(s, "founder_find_investors.png", 2880, 1800, R - 5.65, 2.85, 5.65, "Founder: find investors ranked by fit");
  marker(s, "A", a.x + a.w * 0.565, a.y + a.h * 0.43);
  marker(s, "B", b.x + b.w * 0.543, b.y + b.h * 0.653);
  keyItem(s, "A", "Readiness at a glance", CX, a.bottom + 0.35, 4);
  keyItem(s, "B", "Investors ranked by their own criteria", CX, a.bottom + 0.78, 4.2);
  T(s, "Intro requests unlock at readiness 50", { x: CX, y: a.bottom + 1.3, w: 4.5, h: 0.26, fontSize: 12, color: K.dim });
  s.addNotes(
    "The founder journey, all implemented: register (Neon Auth), build a startup profile, upload the pitch deck and materials, run the readiness evaluation, discover investors and request intros.\n" +
    "Left: the founder dashboard with projects, best readiness, investor matches and pending intros (A). Right: Find investors. Investors are ranked by how well the startup meets each investor's own criteria, with the reasons on every card (B).\n" +
    "Guard rails: intro requests unlock once a published project reaches readiness 50, and verified companies get a higher daily limit. Investors answer Interested or Pass; unanswered requests expire after 14 days. Screens are from the running app with demo data."
  );
}

// =====================================================================
// 05. THE INVESTOR EXPERIENCE
// =====================================================================
if (want(5)) {
  const s = slide();
  rail(s, "05", "INVESTORS");
  head(s, "Less noise. More relevant opportunities.");
  const a = shot(s, "investor_overview.png", 2880, 1360, CX, 1.55, 6.5, "Investor overview: thesis and best fits");
  const b = shot(s, "match_priorities.png", 1466, 904, R - 4.45, 1.55, 4.45, "Investor criteria: match priorities");
  T(s, "Their own thesis and best fits", { x: CX, y: a.bottom + 0.12, w: 6.5, h: 0.24, fontSize: 11, color: K.dim });
  T(s, "Their own priorities: how much each criterion counts", { x: b.x, y: b.bottom + 0.12, w: 4.45, h: 0.24, fontSize: 11, color: K.dim });
  hsteps(s, ["Register and verify", "Define investment thesis", "Set sector, stage, geography, cheque", "Discover startups", "Review matching reasons", "Express interest"], CX, R, 5.55);
  s.addNotes(
    "Investors have their own workspace: overview, Discover, deal flow, portfolio and finances, company updates, firm (team accounts), criteria and verification.\n" +
    "Journey: register and get verified (an admin reviews evidence of investing activity; unverified investors can browse but not request intros), define the thesis across ten areas, set how much each criterion matters (High, Medium, Low or Ignore), discover startups ranked by fit, read the reasons and express interest.\n" +
    "Left: the investor overview with the thesis summary and best fits. Right: match priorities from the criteria page. Discover starts from the saved criteria; changing filters never overwrites them. Screens use demo data."
  );
}

// =====================================================================
// 06. AI-POWERED READINESS
// =====================================================================
if (want(6)) {
  const s = slide();
  rail(s, "06", "AI READINESS");
  head(s, "Know what investors will question before they do.");
  T(s, "FIVE DIMENSIONS  ·  0–100", { x: CX, y: 1.6, w: 4.8, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2 });
  const dims = [["Problem & solution fit", 60], ["Market sizing & competition", 40], ["Business model clarity", 40], ["Traction & validation", 35], ["Product & technology", 35]];
  const lw = 4.9;
  dims.forEach(([d, v], i) => {
    const y = 2.0 + i * 0.6;
    T(s, d, { x: CX, y, w: lw - 0.6, h: 0.28, fontSize: 15 });
    T(s, String(v), { x: CX + lw - 0.6, y, w: 0.6, h: 0.28, fontSize: 18, fontFace: SERIF, color: K.violet, align: "right" });
    rect(s, { x: CX, y: y + 0.36, w: lw, h: 0.06, fill: { color: K.line2 } });
    rect(s, { x: CX, y: y + 0.36, w: (lw * v) / 100, h: 0.06, fill: { color: K.indigo } });
  });
  T(s, "Scores shown: demo startup, rule-based mode", { x: CX, y: 5.0, w: lw, h: 0.22, fontSize: 10, color: K.dim });
  const outs = [["Overall score", "Strengths", "Gaps by severity"], ["Prioritised fixes", "Industry insights"]];
  outs.forEach((row, r) => {
    let x = CX;
    row.forEach((o) => { const w = 0.4 + o.length * 0.088; pill(s, o, x, 5.42 + r * 0.46, w, { h: 0.36, size: 12 }); x += w + 0.1; });
  });
  rr(s, { x: CX + 4.05, y: 5.88, w: 1.65, h: 0.36, rectRadius: 0.18, fill: { color: K.bg }, line: { color: K.green, width: 1 } });
  T(s, "Founder-only", { x: CX + 4.05, y: 5.88, w: 1.65, h: 0.36, fontSize: 12, bold: true, color: K.green, align: "center", valign: "middle" });
  const a = shot(s, "readiness.png", 2169, 1793, R - 5.35, 1.6, 5.35, "Readiness report");
  T(s, "Instant rule-based check on creation (shown)  ·  Gemini or Claude on Re-analyze", { x: a.x, y: a.bottom + 0.1, w: a.w, h: 0.22, fontSize: 10, color: K.dim, align: "right" });
  s.addNotes(
    "Verified in backend/app/services/analysis_service.py.\n" +
    "The report reads everything the founder provides together: the startup profile, uploaded materials (pitch deck, business plan, research; PDFs and images natively, other documents as extracted text), the public GitHub repository and the demo link.\n" +
    "Five dimensions scored 0 to 100: problem/solution fit, market sizing and competition, business model clarity, traction and validation, product and technology. Outputs: an overall score, strengths, gaps with a severity, prioritised recommendations and industry-specific insights. Every run is stored, so founders see their history.\n" +
    "Engines: Anthropic Claude when ANTHROPIC_API_KEY is set; otherwise Google Gemini when GEMINI_API_KEY is set (with fallback models; this is what our environment uses); otherwise a transparent rule-based checker. Both AI engines share the same schema-constrained JSON output. The rule-based result is labelled as such in the UI.\n" +
    "Important: the screenshot and the scores on the left come from the instant rule-based check that runs when a project is first created, so we don't present them as an LLM evaluation. In our environment a Google Gemini key is configured: clicking Re-analyze sends the materials to Gemini and replaces the report (Claude is used instead when an Anthropic key is set). The free Gemini tier can be busy; if it is, the app says so and the stored report stays.\n" +
    "Privacy: investors never see the readiness score; drafts are never matched or announced."
  );
}

// =====================================================================
// 07. EXPLAINABLE MATCHING
// =====================================================================
if (want(7)) {
  const s = slide();
  rail(s, "07", "EXPLAINABLE MATCHING");
  head(s, "Not just a match. A reason why.");
  const flow = [["Startup profile", "+ investor thesis"], ["Score 7 criteria", "0–100 each"], ["Weight by priorities", "the investor's own"], ["Fit score", "+ a reason each"]];
  const fw = (CWv - 3 * 0.45) / 4;
  flow.forEach(([a, b], i) => {
    const x = CX + i * (fw + 0.45), last = i === 3;
    box(s, x, 1.55, fw, 0.78, { fill: last ? K.s2 : K.s1, border: last ? K.indigo : K.line2, bw: last ? 1.25 : 0.75 });
    T(s, a, { x: x + 0.15, y: 1.62, w: fw - 0.3, h: 0.34, fontSize: 15, bold: true, align: "center", valign: "middle" });
    T(s, b, { x: x + 0.15, y: 1.96, w: fw - 0.3, h: 0.26, fontSize: 11, color: K.muted, align: "center", valign: "middle" });
    if (i < 3) ln(s, x + fw + 0.07, 1.94, x + fw + 0.38, 1.94, { color: K.indigo, width: 1.25, arrow: true });
  });
  const crit = [["Industry", 3, "High"], ["Stage", 3, "High"], ["Cheque size", 2, "Medium"], ["Geography", 2, "Medium"], ["Traction", 2, "Medium"], ["Team and IP", 2, "Medium"], ["Business model", 1, "Low"]];
  T(s, "DEFAULT PRIORITIES", { x: CX, y: 2.75, w: 4, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2 });
  crit.forEach(([c, w, p], i) => {
    const y = 3.1 + i * 0.44;
    T(s, c, { x: CX, y, w: 1.8, h: 0.3, fontSize: 14, valign: "middle" });
    for (let k = 0; k < 3; k++) rect(s, { x: CX + 1.85 + k * 0.32, y: y + 0.1, w: 0.26, h: 0.1, fill: { color: k < w ? K.indigo : K.line2 } });
    T(s, p, { x: CX + 2.9, y, w: 1, h: 0.3, fontSize: 12, color: K.muted, valign: "middle" });
  });
  T(s, "Investors set their own  ·  exclusions remove a startup", { x: CX, y: 6.25, w: 4.6, h: 0.22, fontSize: 10, color: K.dim });
  const a = shot(s, "match_reasons.png", 2240, 1110, R - 6.7, 2.75, 6.7, "Startup page: fit score with reasons");
  marker(s, "A", a.x + a.w * 0.81, a.y + a.h * 0.43);
  marker(s, "B", a.x + a.w * 0.012, a.y + a.h * 0.72);
  keyItem(s, "A", "Fit score", a.x, a.bottom + 0.15, 1.4);
  keyItem(s, "B", "A reason per criterion", a.x + 2.1, a.bottom + 0.15, 2.6);
  s.addNotes(
    "Verified in backend/app/services/match_service.py and schemas/thesis.py.\n" +
    "Each criterion is scored 0 to 100: industry (exact focus, overlapping sector or matching technology), stage (one step away earns partial credit, 78), cheque size versus the raise, business model, and, only when the investor set them, geography, traction and team/IP.\n" +
    "Weights come from the investor's priorities: High = 3, Medium = 2, Low = 1, Ignore = 0 (defaults shown). The fit is the weighted average, kept between 40 and 98.8; under 45 isn't recommended. Hard exclusions remove a startup entirely: an excluded industry or country, or an unmet required traction or team requirement.\n" +
    "Each criterion returns a plain-language reason, as on the screen. Matching is deterministic and auditable; AI is used for readiness, not to hide how fit is calculated. Founders see the same scores against each investor's criteria."
  );
}

// =====================================================================
// 08. WHAT MAKES VENTUREX DIFFERENT
// =====================================================================
if (want(8)) {
  const s = slide();
  rail(s, "08", "WHY VENTUREX");
  head(s, "The advantage isn't one feature. It's how everything works together.", { w: 10.6 });
  // the loop
  const cx = 4.05, cy = 4.15, r = 1.45;
  dot(s, cx, cy, r * 2, { fill: { type: "none" }, line: { color: K.line2, width: 1.5 } });
  [45, 135, 225, 315].forEach((deg) => {
    const t = (deg * Math.PI) / 180, x = cx + r * Math.sin(t), y = cy - r * Math.cos(t);
    s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: x - 0.09, y: y - 0.08, w: 0.18, h: 0.16, rotate: deg + 90, fill: { color: K.indigo }, line: { type: "none" } });
  });
  const nodes = [["ASSESS", 0], ["MATCH", 90], ["EXPLAIN", 180], ["CONNECT", 270]];
  nodes.forEach(([t, deg], i) => {
    const a = (deg * Math.PI) / 180, x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
    dot(s, x, y, 0.5, { fill: { color: i === 3 ? K.indigo : K.s2 }, line: { color: K.indigo, width: 1.5 } });
    T(s, "0" + (i + 1), { x: x - 0.25, y: y - 0.25, w: 0.5, h: 0.5, fontSize: 11, bold: true, color: i === 3 ? K.onAccent : K.text, align: "center", valign: "middle" });
    const lw = 1.5;
    const pos = deg === 0 ? { x: x - lw / 2, y: y - 0.62, al: "center" } : deg === 180 ? { x: x - lw / 2, y: y + 0.32, al: "center" }
      : deg === 90 ? { x: x + 0.35, y: y - 0.15, al: "left" } : { x: x - 0.35 - lw, y: y - 0.15, al: "right" };
    T(s, t, { x: pos.x, y: pos.y, w: lw, h: 0.3, fontSize: 15, bold: true, align: pos.al, valign: "middle" });
  });
  T(s, "VentureX", { x: cx - 1, y: cy - 0.2, w: 2, h: 0.4, fontSize: 20, fontFace: SERIF, color: K.indigo, align: "center", valign: "middle" });
  // what each step means + highlights
  const rx = 7.05, rw = R - rx;
  const lines = [["Assess", "AI readiness finds the gaps"], ["Match", "Ranked by the investor's own criteria"], ["Explain", "A reason for every criterion"], ["Connect", "Founder-approved intro opens a deal room"]];
  lines.forEach(([a, b], i) => {
    const y = 1.95 + i * 0.58;
    if (i) ln(s, rx, y - 0.08, R, y - 0.08, { color: K.line, width: 0.75 });
    T(s, a, { x: rx, y, w: 1.2, h: 0.4, fontSize: 14, bold: true, color: K.indigo, valign: "middle" });
    T(s, b, { x: rx + 1.25, y, w: rw - 1.25, h: 0.4, fontSize: 15, valign: "middle" });
  });
  T(s, "HIGHLIGHTS", { x: rx, y: 4.45, w: 3, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2 });
  const hl = [["Private readiness reports", "Explainable weighted matching"], ["Founder-controlled intros", "Integrated deal rooms"], ["Built for Indian rounds"]];
  hl.forEach((row, r2) => {
    let x = rx;
    row.forEach((t) => { const w = 0.4 + t.length * 0.088; pill(s, t, x, 4.8 + r2 * 0.46, w, { h: 0.36, size: 12 }); x += w + 0.1; });
  });
  T(s, "Steps exist individually elsewhere (e.g. OpenVC deck scores and fit ranking; Gust data rooms for investor groups). Our focus is connecting them.",
    { x: CX, y: 6.6, w: CWv - 2.2, h: 0.3, fontSize: 9, color: K.dim });
  s.addNotes(
    "Our differentiation is the combination, not exclusivity. Assess, match, explain and connect form one loop: a founder fixes readiness gaps, sees which investors now fit and why, and a founder-approved intro opens a private deal room. What happens in the room (and the next readiness run) feeds back into the loop.\n" +
    "Highlights: readiness is private to the founder; matching is weighted by each investor's own priorities and explained per criterion; intros run both ways but the founder always decides; deal rooms have chat, NDA, documents, deal stage, funding round and an audit trail; built for Indian rounds (rupees in lakh/crore, company verification by company email or GSTIN/CIN, committed vs received capital with exact decimal maths).\n" +
    "Competitor basis (public product, pricing and help-centre pages, reviewed Nov 2026; no signed-in dashboards inspected): OpenVC has an AI deck score, a Fundability test and investor search ranked by fit, but no data room. Gust has a benchmark tool, directory filters and data rooms for investor groups. F6S is an accelerator and grant marketplace with a pipeline CRM. Wellfound is now a hiring platform. We found no public description elsewhere of per-criterion reasons weighted by the investor's priorities."
  );
}

// =====================================================================
// 09. ARCHITECTURE
// =====================================================================
if (want(9)) {
  const s = slide("VX Soft");
  rail(s, "09", "ARCHITECTURE");
  head(s, "Engineered as a complete, modular technology platform.");
  const mx = CX, mw = 8.45, ex = 10.2, ew = R - ex;
  const band = (y, h, tag, o = {}) => {
    box(s, mx, y, mw, h, { fill: o.fill || K.s1, border: o.border || K.line2, bw: o.border ? 1.25 : 0.75 });
    T(s, tag, { x: mx + 0.2, y, w: 1.3, h, fontSize: 10, bold: true, color: o.tagColor || K.muted, charSpacing: 2, valign: "middle" });
  };
  const inner = mx + 1.55, iw = mw - 1.75;
  band(1.55, 0.56, "CLIENTS");
  ["Founder portal", "Investor portal", "Admin review"].forEach((t, i) => pill(s, t, inner + i * (iw / 3) + 0.05, 1.63, iw / 3 - 0.1, { h: 0.4, size: 12 }));
  band(2.32, 0.56, "FRONTEND");
  T(s, "Next.js 16  ·  React 19  ·  Tailwind CSS 4", { x: inner, y: 2.32, w: iw, h: 0.56, fontSize: 15, valign: "middle" });
  band(3.09, 0.56, "API", { fill: K.s2, border: K.indigo, tagColor: K.violet });
  T(s, "Python  ·  FastAPI  ·  Pydantic  ·  " + F.endpoints + " endpoints", { x: inner, y: 3.09, w: iw, h: 0.56, fontSize: 15, valign: "middle" });
  band(3.86, 1.0, "SERVICES");
  const svc = ["AI readiness engine", "Matching engine", "Auth & access", "Deal room services", "Integrations"];
  const sw = (iw - 4 * 0.1) / 5;
  svc.forEach((t, i) => {
    const x = inner + i * (sw + 0.1);
    box(s, x, 3.98, sw, 0.76, { fill: K.s2 });
    T(s, t, { x: x + 0.05, y: 3.98, w: sw - 0.1, h: 0.76, fontSize: 11, bold: true, align: "center", valign: "middle" });
  });
  band(5.07, 0.56, "DATA");
  T(s, "Neon PostgreSQL  ·  " + F.tables + " relational tables  ·  private file storage", { x: inner, y: 5.07, w: iw, h: 0.56, fontSize: 15, valign: "middle" });
  [[2.11, 2.32], [2.88, 3.09], [3.65, 3.86], [4.86, 5.07]].forEach(([a, b]) => ln(s, inner + iw / 2, a, inner + iw / 2, b, { color: K.indigo, width: 1.25, arrow: true }));
  // external services, wired to the layers that use them
  T(s, "EXTERNAL SERVICES", { x: ex, y: 1.55, w: ew, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2 });
  const ext = [["Neon Auth", "Better Auth · signed JWT"], ["Anthropic Claude", "readiness analysis"], ["Google Gemini", "readiness analysis"], ["GitHub API", "repository intake"], ["SMTP email", "notifications"]];
  const ey = 1.9, eh = 0.56, eg = 0.12, bus = ex - 0.22;
  ln(s, bus, ey + eh / 2, bus, ey + 4 * (eh + eg) + eh / 2, { color: K.line2, dash: "dash" });
  ln(s, mx + mw, 3.37, bus, 3.37, { color: K.line2, dash: "dash" });
  ln(s, mx + mw, 4.36, bus, 4.36, { color: K.line2, dash: "dash" });
  ext.forEach(([a, b], i) => {
    const y = ey + i * (eh + eg);
    ln(s, bus, y + eh / 2, ex, y + eh / 2, { color: K.line2, dash: "dash" });
    box(s, ex, y, ew, eh, { fill: K.s1 });
    T(s, a, { x: ex + 0.15, y: y + 0.06, w: ew - 0.3, h: 0.24, fontSize: 12, bold: true });
    T(s, b, { x: ex + 0.15, y: y + 0.3, w: ew - 0.3, h: 0.2, fontSize: 10, color: K.muted });
  });
  // delivery
  T(s, "DELIVERY", { x: CX, y: 6.02, w: 1.2, h: 0.36, fontSize: 10, bold: true, color: K.muted, charSpacing: 2, valign: "middle" });
  let x = CX + 1.3;
  ["Docker", "Render blueprint", "pytest", "Playwright", "GitHub"].forEach((t) => { const w = 0.4 + t.length * 0.09; pill(s, t, x, 6.02, w, { h: 0.36, size: 12, color: K.muted }); x += w + 0.1; });
  T(s, "Verified from frontend/package.json, backend/requirements.txt, schema.sql, render.yaml", { x: CX, y: 6.6, w: 8, h: 0.22, fontSize: 9, color: K.dim });
  s.addNotes(
    "Every item was checked in the code.\n" +
    "Clients: the founder portal, the investor portal, and an admin area for verification review.\n" +
    "Frontend: Next.js 16.3 (App Router), React 19.2, Tailwind CSS 4. Users sign in through Neon Auth; the browser sends a short-lived signed token with every API call.\n" +
    "API: Python, FastAPI, Pydantic v2; " + F.routeModules + " route modules and " + F.endpoints + " endpoints. Each token is verified against Neon Auth's published keys (JWKS), then role checks (founder, investor, admin) and team access apply.\n" +
    "Services: AI readiness (Claude, Gemini or the rule-based fallback), the deterministic matching engine, auth and access control, deal rooms (NDA, documents, audit trail) plus funding rounds and notifications, and integrations.\n" +
    "Data: Neon PostgreSQL with " + F.tables + " tables over Neon's HTTPS SQL endpoint (psycopg over TCP also supported); the schema is applied idempotently at startup; money is exact decimals; multi-step writes are atomic batches. The transport retries brief connection failures. Private files (decks, deal-room files) are stored on the server's private disk.\n" +
    "External services: Neon Auth (Better Auth), Anthropic Claude and Google Gemini (only when an API key is set), the GitHub API, and SMTP email (written to a log until SMTP is configured).\n" +
    "Delivery: Docker and a Render blueprint (render.yaml) with a persistent disk; tests with pytest and Playwright; code on GitHub. The blueprint is ready, but the app is not deployed publicly yet."
  );
}

// =====================================================================
// 09b. THREE TECHNICAL DECISIONS (rubric A4: "why did you choose these tools?")
// =====================================================================
if (want(21)) {
  const s = slide();
  rail(s, "10", "TECHNICAL DECISIONS");
  head(s, "Three decisions we made, and why.");
  const cards = [
    ["Rules, not a model, for matching", "Every fit score must come with reasons an investor can check, using weights the investor sets.", "No learning from past deals yet"],
    ["AI with a fallback for readiness", "Claude or Gemini reads the deck and code. A rule-based check keeps it working with no key or during an outage.", "Rule-based mode checks coverage, not quality"],
    ["Postgres over HTTPS", "Our network blocks the database port (5432). Neon's HTTPS endpoint works anywhere, with exact decimals for money.", "No long transactions, so multi-step writes run as atomic batches"],
  ];
  const cw = (CWv - 2 * 0.35) / 3;
  cards.forEach(([t, why, trade], i) => {
    const x = CX + i * (cw + 0.35), y = 1.75;
    box(s, x, y, cw, 4.55, { fill: K.s1 });
    T(s, "0" + (i + 1), { x: x + 0.35, y: y + 0.3, w: 1, h: 0.4, fontSize: 24, fontFace: SERIF, color: K.indigo });
    T(s, t, { x: x + 0.35, y: y + 0.85, w: cw - 0.7, h: 0.8, fontSize: 20, fontFace: SERIF });
    T(s, "WHY", { x: x + 0.35, y: y + 1.85, w: 2, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2 });
    T(s, why, { x: x + 0.35, y: y + 2.15, w: cw - 0.7, h: 1.4, fontSize: 14 });
    ln(s, x + 0.35, y + 3.6, x + cw - 0.35, y + 3.6, { color: K.line, width: 0.75 });
    T(s, "TRADE-OFF", { x: x + 0.35, y: y + 3.75, w: 2, h: 0.22, fontSize: 10, bold: true, color: K.violet, charSpacing: 2 });
    T(s, trade, { x: x + 0.35, y: y + 4.0, w: cw - 0.7, h: 0.5, fontSize: 12, color: K.muted });
  });
  s.addNotes(
    "Rubric A4 asks why we chose our tools. These are the three decisions with the biggest effect on the design.\n" +
    "1. Matching uses transparent, weighted rules (backend/app/services/match_service.py), not a trained model or an LLM. Reason: investors and founders need to see why a startup fits, and investors set the weights themselves (High 3, Medium 2, Low 1, Ignore 0). It is deterministic, so we can unit-test it. Trade-off: it doesn't learn from past deals; that could be added later on top of the same explanations.\n" +
    "2. Readiness uses Claude, then Gemini, then a rule-based checker (analysis_service.py). Reason: AI can read pitch decks (PDF, images), documents and GitHub code, but we didn't want the feature to fail without an API key or during a provider outage. AI output must match a fixed JSON schema or it is rejected. Trade-off: rule-based mode only checks which investor-relevant topics are covered, not how good they are, and it says so in the UI.\n" +
    "3. The database is Neon PostgreSQL reached over Neon's HTTPS SQL endpoint (postgres.py). Reason: the network we develop on resets connections on the Postgres port 5432, while HTTPS (443) works everywhere; Postgres also gives exact decimals for rupee amounts and relational integrity. Trade-off: no interactive transactions, so multi-step writes (funding receipts, team changes) run as atomic batches. We also added retries for brief DNS failures.\n" +
    "Other choices if asked: FastAPI + Pydantic for typed validation; Next.js for both portals; Neon Auth so we never store passwords ourselves."
  );
}

// =====================================================================
// 09c. DATA, ACCESS AND AI FAILURE (rubric A4: "where is user data stored, and who can see it?")
// =====================================================================
if (want(22)) {
  const s = slide();
  rail(s, "11", "DATA & SAFETY");
  head(s, "Where the data lives, and who can see it.");
  T(s, "WHERE IT LIVES", { x: CX, y: 1.65, w: 4, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2 });
  const stores = [["Neon PostgreSQL", "AWS us-west-2 · profiles, intros, deal rooms"], ["Private server disk", "pitch decks and deal-room files"], ["Neon Auth", "passwords and sessions; we never store them"]];
  stores.forEach(([a, b], i) => {
    const y = 2.0 + i * 0.9;
    box(s, CX, y, 4.6, 0.76, { fill: K.s1 });
    T(s, a, { x: CX + 0.25, y: y + 0.1, w: 4.1, h: 0.3, fontSize: 15, bold: true });
    T(s, b, { x: CX + 0.25, y: y + 0.4, w: 4.1, h: 0.28, fontSize: 12, color: K.muted });
  });
  const rx = CX + 5.1, rw = R - rx;
  T(s, "WHO CAN SEE WHAT", { x: rx, y: 1.65, w: 4, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2 });
  const rows = [["Readiness report", "Founder only"], ["Draft startups", "Founder only"], ["Published startup", "Investors"], ["Contact details", "After the founder accepts an intro"], ["Deal room and files", "The two parties only"], ["Verification evidence", "Admin reviewers"]];
  rows.forEach(([a, b], i) => {
    const y = 2.0 + i * 0.44;
    if (i) ln(s, rx, y - 0.04, R, y - 0.04, { color: K.line, width: 0.75 });
    T(s, a, { x: rx, y, w: 2.9, h: 0.38, fontSize: 14, valign: "middle" });
    T(s, b, { x: rx + 2.95, y, w: rw - 2.95, h: 0.38, fontSize: 14, bold: true, color: i < 2 ? K.indigo : K.text, valign: "middle" });
  });
  const by = 4.95;
  box(s, CX, by, CWv, 1.45, { fill: K.s2 });
  T(s, "WHEN THE AI GIVES A WRONG ANSWER", { x: CX + 0.3, y: by + 0.18, w: 6, h: 0.22, fontSize: 10, bold: true, color: K.violet, charSpacing: 2 });
  const pts = ["Output must match a fixed format, or it's rejected", "Scores are private advice the founder can re-run", "Matching never uses AI, so a bad answer can't change who sees whom"];
  const pw = (CWv - 0.6) / 3;
  pts.forEach((p, i) => T(s, p, { x: CX + 0.3 + i * pw, y: by + 0.55, w: pw - 0.3, h: 0.75, fontSize: 14 }));
  T(s, "No passwords or keys in the code: secrets live in .env files that git ignores", { x: CX, y: 6.6, w: CWv - 2, h: 0.24, fontSize: 11, color: K.dim });
  s.addNotes(
    "Rubric A4 asks where user data is stored, who can see it, and what happens when the model gives a wrong answer.\n" +
    "Storage: structured data (accounts, profiles, startups, investor criteria, intros, deal-room messages, funding rounds) is in Neon PostgreSQL hosted on AWS us-west-2. Uploaded pitch decks and deal-room files are stored on the server's private disk (private_uploads), never in a public folder; downloads go through the API with an access check. Passwords and sessions are handled by Neon Auth (Better Auth); our API only verifies signed, short-lived tokens.\n" +
    "Access: every API request checks the signed-in user, their role (founder, investor, admin) and team membership. Readiness reports and draft startups are visible only to the founder (and co-founders). Investors see published startups, minus anything the founder chose to hide (traction, contact). Contact details are shared only after an intro is accepted. Deal rooms, messages and files are visible only to the two parties, and every room action is written to an audit log. Verification evidence is visible to admin reviewers.\n" +
    "AI failure: the AI's answer must match a fixed JSON schema; if it doesn't, it's rejected with a clear error and the founder can retry. The readiness report is advice shown only to the founder; it doesn't change what investors see. Matching is rule-based, so an AI mistake can never change which investors see which startups.\n" +
    "Secrets: API keys and the database URL live in .env files excluded by .gitignore; only .env.example templates are in the repository. We scanned the repository for key patterns before the review."
  );
}

// =====================================================================
// 10. ENGINEERING EXCELLENCE
// =====================================================================
if (want(10)) {
  const s = slide();
  rail(s, "12", "ENGINEERING");
  head(s, "More than a prototype. A tested, integrated system.");
  // test pyramid: broad automated base, end-to-end checks on top
  const pc = CX + 2.5, tiers = [[F.browserSuites, "browser test suites", "Playwright", 3.5], [F.apiFlowChecks, "API flow checks", "end to end", 4.25], [F.backendTests, "backend tests", "pytest", 5.0]];
  tiers.forEach(([n, a, b, w], i) => {
    const y = 1.75 + i * 1.08;
    box(s, pc - w / 2, y, w, 0.94, { fill: i === 2 ? K.s2 : K.s1, border: i === 2 ? K.indigo : K.line2, bw: i === 2 ? 1.25 : 0.75 });
    T(s, String(n), { x: pc - w / 2 + 0.2, y, w: 1.0, h: 0.94, fontSize: 32, fontFace: SERIF, color: i === 2 ? K.text : K.violet, valign: "middle" });
    T(s, [{ text: a, options: { breakLine: true } }, { text: b, options: { fontSize: 11, color: K.muted } }], { x: pc - w / 2 + 1.25, y: y + 0.16, w: w - 1.4, h: 0.62, fontSize: 14, valign: "middle" });
  });
  T(s, "Latest runs: 24 Nov 2026", { x: pc - 2.5, y: 5.1, w: 5, h: 0.22, fontSize: 10, color: K.dim, align: "center" });
  // engineering surface by discipline
  const rx = 7.0, rw = R - rx;
  const rows = [["Frontend", "Two portals and an admin area on Next.js"], ["Backend", F.endpoints + " endpoints with role checks on signed tokens"], ["Data", F.tables + " tables, exact decimals, atomic writes, audit trails"],
    ["AI", "Claude or Gemini, with a rule-based fallback"], ["Product", "Deal rooms, NDAs, documents, funding rounds"]];
  rows.forEach(([a, b], i) => {
    const y = 1.75 + i * 0.66;
    if (i) ln(s, rx, y - 0.05, R, y - 0.05, { color: K.line, width: 0.75 });
    T(s, a.toUpperCase(), { x: rx, y, w: 1.25, h: 0.56, fontSize: 10, bold: true, color: K.indigo, charSpacing: 2, valign: "middle" });
    T(s, b, { x: rx + 1.3, y, w: rw - 1.3, h: 0.56, fontSize: 14, valign: "middle" });
  });
  T(s, "Built across product, frontend, backend, database, AI and testing", { x: CX, y: 5.75, w: CWv, h: 0.3, fontSize: 14, color: K.muted });
  s.addNotes(
    "Numbers from our latest runs (24 Nov 2026): " + F.backendTests + " backend tests passing (pytest; the full run after the connection fix passed " + F.backendTests + "/" + F.backendTests + "); the API flow with " + F.apiFlowChecks + " checks passing; seven Playwright browser suites (founder outreach, investor portal, verification, investor updates, teams, profiles and funding, portfolio CSV) that drive the real app in Chrome with test accounts.\n" +
    "Engineering surface: two portals and an admin area; " + F.endpoints + " endpoints across " + F.routeModules + " route modules with role checks on verified tokens; " + F.tables + " relational tables with exact decimal money, atomic multi-step writes and audit trails; two AI providers with a rule-based fallback and schema-constrained output; deal rooms with NDA signing, documents and an audit log; funding rounds separating committed from received capital; document intake for PDF, PPTX, DOCX and images.\n" +
    "What we don't claim: no security certification, and it isn't deployed publicly yet. Emails are written to a log until SMTP is configured, and there's no background scheduler yet."
  );
}

// =====================================================================
// 10b. WHAT WORKS TODAY, AND WHAT ISN'T BUILT (rubric A3 + "a short written list of what you have not built")
// =====================================================================
if (want(23)) {
  const s = slide();
  rail(s, "13", "STATUS");
  head(s, "What works today, and what we haven't built yet.");
  const lw = 5.0;
  T(s, "WORKS TODAY", { x: CX, y: 1.65, w: 4, h: 0.22, fontSize: 10, bold: true, color: K.green, charSpacing: 2 });
  const works = ["Founder profile, materials and readiness report", "Investor criteria with weighted priorities", "Fit scores with reasons, in both directions", "Intro requests, Interested or Pass, 14-day expiry", "Deal rooms: chat, NDA, documents, audit log", "Investor and company verification", "Team accounts, funding rounds, investor updates"];
  works.forEach((t, i) => {
    const y = 2.0 + i * 0.52;
    dot(s, CX + 0.12, y + 0.17, 0.2, { fill: { color: K.green } });
    T(s, t, { x: CX + 0.4, y, w: lw - 0.4, h: 0.34, fontSize: 14, valign: "middle" });
  });
  const rx = CX + lw + 0.5, rw = R - rx;
  T(s, "NOT BUILT YET", { x: rx, y: 1.65, w: 3, h: 0.22, fontSize: 10, bold: true, color: K.violet, charSpacing: 2 });
  T(s, "WHY", { x: rx + 2.6, y: 1.65, w: 2, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2 });
  const gaps = [["Payments", "Pricing needs pilot feedback first"], ["Live email sending", "Needs a sending domain; emails are logged for now"], ["Public deployment", "Blueprint ready; hosting with storage is paid"], ["Paid AI plan", "Free Gemini tier can be busy; rules cover outages"], ["Scheduled jobs", "Expiry runs when pages load instead"], ["Semantic matching", "We chose explainable rules first"]];
  gaps.forEach(([a, b], i) => {
    const y = 2.0 + i * 0.6;
    if (i) ln(s, rx, y - 0.06, R, y - 0.06, { color: K.line, width: 0.75 });
    T(s, a, { x: rx, y, w: 2.5, h: 0.46, fontSize: 14, bold: true, valign: "middle" });
    T(s, b, { x: rx + 2.6, y, w: rw - 2.6, h: 0.46, fontSize: 13, color: K.muted, valign: "middle" });
  });
  box(s, CX, 5.85, CWv, 0.6, { fill: K.s2 });
  T(s, [{ text: "Main flow, tested end to end:  ", options: { bold: true } }, { text: "founder profile  →  readiness  →  intro  →  investor accepts  →  deal room", options: { color: K.muted } }],
    { x: CX + 0.3, y: 5.85, w: CWv - 0.6, h: 0.6, fontSize: 14, valign: "middle" });
  s.addNotes(
    "Rubric A3 asks what is working today and what is still pending; the checklist asks for a written list of what we did not build, with reasons.\n" +
    "Working today (covered by automated tests): founder profile, materials and the readiness report; investor criteria with priorities; fit scores with reasons in both directions (Find investors and Discover); intro requests with Interested or Pass and a 14-day expiry; deal rooms with chat, NDA signing, documents, deal stage and an audit log; investor verification (admin review) and company verification (company email code or GSTIN/CIN); team accounts; funding rounds with committed vs received capital; investor updates and the portfolio ledger.\n" +
    "Not built, and why: payments, because pricing should come from pilot feedback; live email sending, because it needs a verified sending domain and SMTP credentials (emails are written to a log so we can show them); public deployment, because the Render blueprint is ready but hosting with a persistent disk is a paid plan; a paid AI plan, because of cost: we run on the free Gemini tier, which can be busy, and the rule-based check covers outages; scheduled jobs such as weekly digests (intro expiry runs whenever the relevant pages load instead); semantic matching with embeddings, because we chose explainable rules first.\n" +
    "If the internet fails during the demo, the screenshots in these slides show every step of the main flow."
  );
}

// =====================================================================
// 11. THE LIVE EXPERIENCE
// =====================================================================
if (want(11)) {
  const s = slide("VX Close");
  rail(s, "14", "LIVE DEMO");
  head(s, "Enough about the idea. Let's experience VentureX.");
  // both journeys meet in a real deal room
  const sw = 5.5, sx = MID - sw / 2;
  T(s, "WHERE BOTH JOURNEYS MEET", { x: sx, y: 1.55, w: sw, h: 0.22, fontSize: 10, bold: true, color: K.violet, charSpacing: 3, align: "center" });
  const a = shot(s, "deal_room.png", 2880, 1085, sx, 1.85, sw, "Deal room (real screen, demo data)");
  const lane = (x, al, who, steps, col, edge) => {
    T(s, who, { x, y: 1.85, w: 2.4, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 3, align: al });
    steps.forEach((t, i) => {
      const y = 2.2 + i * 0.58;
      pill(s, t, x, y, 2.4, { h: 0.42, size: 13, bold: true, border: col });
      if (i < steps.length - 1) ln(s, x + 1.2, y + 0.42, x + 1.2, y + 0.58, { color: col, width: 1.25 });
    });
    const ly = 2.2 + 2 * 0.58 + 0.21;
    ln(s, al === "left" ? x + 2.4 : x, ly, edge, ly, { color: col, width: 1.25, arrow: true });
  };
  lane(CX, "left", "FOUNDER", ["Readiness", "Matching", "Connections"], K.indigo, a.x - 0.06);
  lane(R - 2.4, "right", "INVESTOR", ["Investment thesis", "Startup discovery", "Deal room"], K.violet, a.right + 0.06);
  mark(s, CX, 4.95, 0.3);
  T(s, "VentureX", { x: CX + 0.62, y: 4.93, w: 3, h: 0.4, fontSize: 22, fontFace: SERIF, valign: "middle" });
  T(s, [{ text: "Ready startups. " }, { text: "Right investors.", options: { color: K.indigo } }], { x: CX, y: 5.4, w: CWv, h: 0.8, fontSize: 44, fontFace: SERIF });
  T(s, "Anshitha Yeruva  |  Nitya Nara", { x: CX, y: 6.5, w: 6, h: 0.3, fontSize: 13, color: K.dim });
  s.addNotes(
    "Hand-off to the live demo (switch to the website; demo data only).\n" +
    "The screen in the middle is a real deal room: once a founder accepts an intro, both sides meet here, with chat, a signed NDA, shared documents and the deal stage.\n" +
    "Founder path: the startup profile and materials; the readiness report (scores, gaps, prioritised fixes); Find investors ranked by fit with reasons; request an intro.\n" +
    "Investor path: the investment thesis and priorities; Discover, which starts from the saved criteria; open a startup to see the fit and its reasons; express interest.\n" +
    "Then accept the intro as the founder and open the deal room. Close: 'Ready startups. Right investors.' Thank you."
  );
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT, ONLY.length ? "(slides " + ONLY.join(",") + ")" : "");
})();
