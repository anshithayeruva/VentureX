// Builds pitch-deck/capstone/VentureX_Capstone_Deck.pptx: the 11-slide product + engineering deck
// (dark, Linear-inspired visual identity; original VentureX branding).
//   cd pitch-deck/src && node build_capstone.js            all slides
//   VX_ONLY=1,2,9 node build_capstone.js                     only some slides (for design review)
// Slides carry headlines, diagrams and real screenshots; the detail lives in the speaker notes.
// Facts are verified against the codebase (see notes on each slide).
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require("./apply_theme.js");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "capstone");
const SHOT = (f) => path.join(ROOT, "assets", "screens", f);
const ART = (f) => path.join(OUT_DIR, "assets", f);
const OUT = process.env.VX_OUT || path.join(OUT_DIR, "previous", "VentureX_Capstone_Deck.pptx");
const ONLY = (process.env.VX_ONLY || "").split(",").filter(Boolean).map(Number);
const want = (n) => !ONLY.length || ONLY.includes(n);

// Verified figures (Nov 2026). BACKEND_TESTS comes from the latest full pytest run.
const BACKEND_TESTS = process.env.VX_BACKEND_TESTS || "120";
const FACTS = { routeModules: 15, endpoints: 143, tables: 29, browserSuites: 7, apiFlowChecks: 89 };

// ---------- design system ----------
const K = {
  bg: "0B0C10", panel: "15171C", panel2: "1B1E25", line: "262A33", line2: "343947",
  text: "F3F4F6", muted: "9AA0AB", dim: "6B7280",
  indigo: "6E78E8", indigoDeep: "4C55C9", violet: "A5A9F5", green: "4CB782", amber: "D9A55B",
};
const THEME = {
  name: "VentureX Graphite", headFontFace: "Arial", bodyFontFace: "Arial",
  colors: { dk1: K.bg, lt1: K.text, dk2: K.panel, lt2: K.muted, accent1: K.indigo, accent2: K.violet, accent3: K.green,
    accent4: K.amber, accent5: K.line2, accent6: K.dim, hlink: K.violet, folHlink: K.muted },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.author = "Anshitha Yeruva, Nitya Nara";
pres.title = "VentureX: AI-powered startup readiness and investor matching";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const W = 13.333, H = 7.5, M = 0.7, CW = W - 2 * M;

const footer = [
  { text: { text: "VentureX", options: { x: M, y: 7.02, w: 3, h: 0.22, fontSize: 9, bold: true, color: K.dim, margin: 0 } } },
];
pres.defineSlideMaster({ title: "VX Plain", background: { color: K.bg }, objects: footer,
  slideNumber: { x: W - M - 0.6, y: 7.02, w: 0.6, h: 0.22, fontSize: 9, color: K.dim, align: "right", margin: 0 } });
pres.defineSlideMaster({ title: "VX Glow", background: { path: ART("bg_soft.png") }, objects: footer,
  slideNumber: { x: W - M - 0.6, y: 7.02, w: 0.6, h: 0.22, fontSize: 9, color: K.dim, align: "right", margin: 0 } });
pres.defineSlideMaster({ title: "VX Cover", background: { path: ART("bg_cover.png") }, objects: [] });
pres.defineSlideMaster({ title: "VX Close", background: { path: ART("bg_close.png") }, objects: [] });

// ---------- helpers ----------
const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, fontSize: 14, color: K.text, valign: "top", fontFace: "Arial", ...o });
const rect = (s, o) => s.addShape(pres.shapes.RECTANGLE, { line: { type: "none" }, ...o });
const rrect = (s, o) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { rectRadius: 0.06, line: { type: "none" }, ...o });
const panel = (s, x, y, w, h, o = {}) => rrect(s, { x, y, w, h, fill: { color: o.fill || K.panel }, line: { color: o.border || K.line, width: 0.75 }, rectRadius: o.r ?? 0.06 });
const circle = (s, cx, cy, d, o) => s.addShape(pres.shapes.OVAL, { x: cx - d / 2, y: cy - d / 2, w: d, h: d, line: { type: "none" }, ...o });
const link = (s, x1, y1, x2, y2, o = {}) => {
  const line = { color: o.color || K.line2, width: o.width || 1 };
  if (o.dash) line.dashType = o.dash;
  if (o.arrow) line.endArrowType = "triangle";
  if (o.both) { line.endArrowType = "triangle"; line.beginArrowType = "triangle"; }
  s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, line });
};
const eyebrow = (s, n, label) => T(s, [{ text: n + "  ", options: { color: K.indigo } }, { text: label, options: { color: K.muted } }],
  { x: M, y: 0.55, w: 8, h: 0.25, fontSize: 11, bold: true, charSpacing: 2 });
const headline = (s, text, o = {}) => T(s, text, { x: M, y: 0.92, w: o.w || CW, h: 1.1, fontSize: o.size || 32, bold: true, color: K.text });
const slide = (master = "VX Plain") => pres.addSlide({ masterName: master });
// A screenshot framed as an app window (thin chrome bar with three dots), with a soft shadow.
const shot = (s, file, pw, ph, x, y, w, name) => {
  const h = (w * ph) / pw, bar = 0.24;
  rrect(s, { x, y, w, h: h + bar, rectRadius: 0.05, fill: { color: K.panel2 }, line: { color: K.line2, width: 0.75 },
    shadow: { type: "outer", color: "000000", opacity: 0.45, blur: 18, offset: 6, angle: 90 } });
  [0, 1, 2].forEach((i) => circle(s, x + 0.17 + i * 0.13, y + bar / 2, 0.07, { fill: { color: K.line2 } }));
  s.addImage({ path: SHOT(file), x, y: y + bar, w, h, altText: name, objectName: name });
  return { x, y: y + bar, w, h, bottom: y + bar + h };
};
// Annotation: a lettered marker pinned on a screenshot, explained in a small key next to it.
const marker = (s, letter, px, py) => {
  circle(s, px, py, 0.46, { fill: { color: K.indigo, transparency: 70 } });
  circle(s, px, py, 0.3, { fill: { color: K.indigo }, line: { color: K.text, width: 1 } });
  T(s, letter, { x: px - 0.15, y: py - 0.15, w: 0.3, h: 0.3, fontSize: 11, bold: true, color: K.text, align: "center", valign: "middle" });
};
const key = (s, items, x, y, o = {}) => {
  let cx = x;
  items.forEach(([letter, text], i) => {
    const yy = o.stack ? y + i * 0.42 : y;
    if (o.stack) cx = x;
    circle(s, cx + 0.15, yy + 0.15, 0.3, { fill: { color: K.indigo } });
    T(s, letter, { x: cx, y: yy, w: 0.3, h: 0.3, fontSize: 11, bold: true, color: K.text, align: "center", valign: "middle" });
    const tw = 0.4 + text.length * 0.09;
    T(s, text, { x: cx + 0.42, y: yy, w: tw, h: 0.3, fontSize: 13, color: K.muted, valign: "middle" });
    cx += 0.42 + tw + 0.35;
  });
};
const chip = (s, text, x, y, w, o = {}) => {
  rrect(s, { x, y, w, h: 0.36, rectRadius: 0.18, fill: { color: o.fill || K.panel2 }, line: { color: o.border || K.line2, width: 0.75 } });
  T(s, text, { x, y, w, h: 0.36, fontSize: o.size || 12, color: o.color || K.text, align: "center", valign: "middle", bold: !!o.bold });
};
// Vertical stepper: numbered nodes on a thin rail.
const stepper = (s, steps, x, y, gap, w, size = 15) => {
  link(s, x + 0.17, y + 0.17, x + 0.17, y + 0.17 + gap * (steps.length - 1), { color: K.line2, width: 1.25 });
  steps.forEach((t, i) => {
    const yy = y + i * gap, last = i === steps.length - 1;
    circle(s, x + 0.17, yy + 0.17, 0.34, { fill: { color: last ? K.indigo : K.bg }, line: { color: last ? K.indigo : K.line2, width: 1.25 } });
    T(s, String(i + 1), { x: x, y: yy, w: 0.34, h: 0.34, fontSize: 11, bold: true, color: last ? K.text : K.muted, align: "center", valign: "middle" });
    T(s, t, { x: x + 0.55, y: yy - 0.02, w, h: 0.38, fontSize: size, color: last ? K.text : K.muted, bold: last, valign: "middle" });
  });
};
const mark = (s, x, y, size = 0.34) => {
  rrect(s, { x, y, w: size, h: size, rectRadius: 0.07, fill: { type: "none" }, line: { color: K.violet, width: 1.5 } });
  rrect(s, { x: x + size * 0.45, y: y + size * 0.45, w: size, h: size, rectRadius: 0.07, fill: { color: K.indigo, transparency: 10 } });
};

// =====================================================================
// 01. COVER
// =====================================================================
if (want(1)) {
  const s = slide("VX Cover");
  mark(s, M, 1.15);
  T(s, "VentureX", { x: M + 0.7, y: 1.17, w: 4, h: 0.45, fontSize: 22, bold: true, valign: "middle" });
  T(s, [{ text: "Get investor-ready.", options: { breakLine: true } }, { text: "Meet investors who fit.", options: { color: K.violet } }],
    { x: M, y: 2.3, w: 7.4, h: 1.75, fontSize: 46, bold: true });
  T(s, "AI-powered startup readiness and investor matching platform", { x: M, y: 4.3, w: 7, h: 0.4, fontSize: 18, color: K.muted });
  T(s, "Anshitha Yeruva  |  Nitya Nara", { x: M, y: 6.45, w: 6, h: 0.3, fontSize: 13, color: K.dim });

  // product-inspired ecosystem: a founder's startup card meets an investor's thesis card through a fit
  const fx = 8.15, fy = 1.45, ix = 9.55, iy = 4.75;
  panel(s, fx, fy, 3.15, 1.5, { fill: K.panel });
  T(s, "FOUNDER  ·  STARTUP", { x: fx + 0.25, y: fy + 0.22, w: 2.6, h: 0.2, fontSize: 9, bold: true, color: K.muted, charSpacing: 2 });
  rect(s, { x: fx + 0.25, y: fy + 0.55, w: 1.6, h: 0.11, fill: { color: K.line2 } });
  rect(s, { x: fx + 0.25, y: fy + 0.75, w: 2.3, h: 0.07, fill: { color: K.line } });
  T(s, "Readiness", { x: fx + 0.25, y: fy + 1.0, w: 1.2, h: 0.22, fontSize: 10, color: K.muted, valign: "middle" });
  rect(s, { x: fx + 1.3, y: fy + 1.08, w: 1.55, h: 0.07, fill: { color: K.line } });
  rect(s, { x: fx + 1.3, y: fy + 1.08, w: 1.1, h: 0.07, fill: { color: K.violet } });

  panel(s, ix, iy, 3.1, 1.5, { fill: K.panel });
  T(s, "INVESTOR  ·  THESIS", { x: ix + 0.25, y: iy + 0.22, w: 2.6, h: 0.2, fontSize: 9, bold: true, color: K.muted, charSpacing: 2 });
  [["Sector", 0.25, 0.85], ["Stage", 1.18, 0.75], ["Cheque", 2.01, 0.85]].forEach(([t, dx, w]) =>
    chip(s, t, ix + dx, iy + 0.55, w, { size: 10, color: K.muted }));
  [0, 1, 2].forEach((k) => rect(s, { x: ix + 0.25 + k * 0.32, y: iy + 1.1, w: 0.26, h: 0.08, fill: { color: k < 2 ? K.indigo : K.line2 } }));
  T(s, "priorities", { x: ix + 1.25, y: iy + 1.02, w: 1.5, h: 0.22, fontSize: 10, color: K.muted, valign: "middle" });

  const px = 9.15, py = 3.3;
  rrect(s, { x: px, y: py, w: 2.55, h: 1.05, rectRadius: 0.08, fill: { color: K.panel2 }, line: { color: K.indigo, width: 1.25 },
    shadow: { type: "outer", color: "000000", opacity: 0.5, blur: 16, offset: 5, angle: 90 } });
  T(s, "96%", { x: px + 0.22, y: py + 0.14, w: 1.2, h: 0.5, fontSize: 26, bold: true, color: K.text, valign: "middle" });
  T(s, "fit", { x: px + 1.25, y: py + 0.24, w: 0.6, h: 0.3, fontSize: 12, color: K.muted, valign: "middle" });
  ["Industry", "Stage", "Cheque"].forEach((t, i) => {
    circle(s, px + 0.3 + i * 0.78, py + 0.82, 0.12, { fill: { color: K.green } });
    T(s, t, { x: px + 0.4 + i * 0.78, y: py + 0.71, w: 0.7, h: 0.22, fontSize: 9, color: K.muted, valign: "middle" });
  });
  // connectors: startup card -> fit -> thesis card
  link(s, fx + 0.6, fy + 1.5, fx + 0.6, py + 0.52, { color: K.indigo, width: 1.25 });
  link(s, fx + 0.6, py + 0.52, px, py + 0.52, { color: K.indigo, width: 1.25, arrow: true });
  link(s, px + 2.55, py + 0.52, ix + 2.65, py + 0.52, { color: K.indigo, width: 1.25 });
  link(s, ix + 2.65, py + 0.52, ix + 2.65, iy, { color: K.indigo, width: 1.25, arrow: true });
  s.addNotes(
    "VentureX is an AI-powered startup readiness and investor matching platform, built as our capstone by Anshitha Yeruva and Nitya Nara.\n" +
    "The visual on the right is the whole idea in one picture: a founder's startup and an investor's thesis meet through a fit score that shows its reasons.\n" +
    "Over the next ten slides we cover the problem, our solution, both user experiences, the AI readiness report, explainable matching, what makes it different, the architecture and the engineering behind it. Then we show it live.\n" +
    "The 96% fit and the cards are illustrative; the real screens come later."
  );
}

// =====================================================================
// 02. THE PROBLEM
// =====================================================================
if (want(2)) {
  const s = slide();
  eyebrow(s, "01", "THE PROBLEM");
  headline(s, "Finding the right investor shouldn't be harder than building the startup.", { w: 11.2 });
  const y = 2.35, h = 3.1, pw = 5.55, gap = CW - 2 * pw;
  const sides = [
    { x: M, label: "FOUNDERS", qs: ["Who should I pitch?", "Is my startup ready?", "Why am I not getting responses?"] },
    { x: M + pw + gap, label: "INVESTORS", qs: ["Which startups fit my thesis?", "How do I screen opportunities?", "How do I avoid wasting time?"] },
  ];
  sides.forEach((sd, k) => {
    panel(s, sd.x, y, pw, h, { fill: K.panel });
    circle(s, sd.x + 0.4, y + 0.45, 0.12, { fill: { color: k ? K.violet : K.indigo } });
    T(s, sd.label, { x: sd.x + 0.58, y: y + 0.34, w: 3, h: 0.24, fontSize: 11, bold: true, color: K.muted, charSpacing: 2, valign: "middle" });
    sd.qs.forEach((q, i) => {
      const yy = y + 0.85 + i * 0.72;
      link(s, sd.x + 0.3, yy - 0.08, sd.x + pw - 0.3, yy - 0.08, { color: K.line, width: 0.75 });
      circle(s, sd.x + 0.5, yy + 0.27, 0.36, { fill: { color: K.panel2 }, line: { color: K.line2, width: 0.75 } });
      T(s, "?", { x: sd.x + 0.32, y: yy + 0.09, w: 0.36, h: 0.36, fontSize: 13, bold: true, color: k ? K.violet : K.indigo, align: "center", valign: "middle" });
      T(s, q, { x: sd.x + 0.9, y: yy + 0.07, w: pw - 1.2, h: 0.4, fontSize: 18, color: K.text, valign: "middle" });
    });
  });
  // the disconnected journey between the two sides
  const cx = M + pw + gap / 2, cy = y + h / 2;
  link(s, M + pw + 0.06, cy, cx - 0.22, cy, { color: K.line2, width: 1.25, dash: "dash" });
  link(s, cx + 0.22, cy, M + pw + gap - 0.06, cy, { color: K.line2, width: 1.25, dash: "dash" });
  T(s, "×", { x: cx - 0.2, y: cy - 0.22, w: 0.4, h: 0.4, fontSize: 18, bold: true, color: K.dim, align: "center", valign: "middle" });
  // verified context
  const stats = [["2,07,135", "DPIIT-recognised startups"], ["1,518", "tech funding rounds in 2025"], ["53%", "fewer investors in 2025 rounds"]];
  const sw = CW / 3;
  stats.forEach(([n, l], i) => {
    const x = M + i * sw + (i ? 0.3 : 0);
    if (i) link(s, M + i * sw, 5.7, M + i * sw, 6.35, { color: K.line, width: 0.75 });
    T(s, n, { x, y: 5.6, w: sw - 0.4, h: 0.45, fontSize: 26, bold: true, color: i === 0 ? K.text : K.violet, valign: "middle" });
    T(s, l, { x, y: 6.05, w: sw - 0.4, h: 0.28, fontSize: 13, color: K.muted, valign: "middle" });
  });
  T(s, "Sources: Ministry of Commerce & Industry (as of 31 Dec 2025, via The Tribune); Tracxn India Tech 2025 (via TechCrunch, 27 Dec 2025). Separate datasets.",
    { x: M, y: 6.5, w: CW - 1, h: 0.22, fontSize: 9, color: K.dim });
  s.addNotes(
    "Founders: investor research is manual, one list and one cold email at a time. Stage, sector and cheque size are rarely clear up front, so they don't know who fits. They can't tell whether their deck, market sizing or traction is good enough, and rejections rarely say what was missing.\n" +
    "Investors: most inbound pitches fall outside the thesis. Every startup describes itself differently, so screening eats partner time before any real conversation.\n" +
    "The two sides search for each other separately, so the journey is disconnected.\n" +
    "Context: India had 2,07,135 DPIIT-recognised startups as of 31 Dec 2025 (Ministry of Commerce & Industry, via The Tribune). Tracxn's 2025 India Tech data (via TechCrunch, 27 Dec 2025): 1,518 funding rounds, down about 39%; roughly 3,170 investors took part in rounds, down 53% from about 6,800; seed funding $1.1B, down 30%. These are separate datasets; don't divide one by the other. Capital is getting more selective, so finding the right match matters more."
  );
}

// =====================================================================
// 03. THE SOLUTION
// =====================================================================
if (want(3)) {
  const s = slide();
  eyebrow(s, "02", "THE SOLUTION");
  headline(s, "One intelligent platform connecting both sides of fundraising.", { w: 11 });
  const cw = 6.3, cx = (W - cw) / 2;
  const node = (y, text, o = {}) => {
    const w = o.w || cw, x = (W - w) / 2;
    rrect(s, { x, y, w, h: o.h || 0.46, rectRadius: (o.h || 0.46) / 2, fill: { color: o.fill || K.panel2 }, line: { color: o.border || K.line2, width: 0.75 } });
    T(s, text, { x, y, w, h: o.h || 0.46, fontSize: o.size || 14, bold: !!o.bold, color: o.color || K.text, align: "center", valign: "middle" });
  };
  node(2.2, "Founder", { w: 2.2, bold: true, border: K.indigo });
  node(2.92, "Startup profile  ·  pitch deck  ·  documents  ·  GitHub", { color: K.muted });
  // the intelligence layer
  const py = 3.62, ph = 1.62;
  rrect(s, { x: cx - 0.35, y: py, w: cw + 0.7, h: ph, rectRadius: 0.08, fill: { color: K.panel }, line: { color: K.indigo, width: 1.25 },
    shadow: { type: "outer", color: "000000", opacity: 0.45, blur: 16, offset: 5, angle: 90 } });
  T(s, "VENTUREX INTELLIGENCE", { x: cx - 0.1, y: py + 0.16, w: 4, h: 0.22, fontSize: 10, bold: true, color: K.violet, charSpacing: 2 });
  const mods = [["AI Readiness", "private report"], ["Explainable Matching", "fit + reasons"], ["Discovery", "both directions"], ["Deal Room", "chat · NDA · files"]];
  const mw = (cw + 0.7 - 0.5 - 3 * 0.15) / 4;
  mods.forEach(([a, b], i) => {
    const x = cx - 0.1 + i * (mw + 0.15);
    panel(s, x, py + 0.5, mw, 0.92, { fill: K.panel2, border: K.line2 });
    T(s, a, { x: x + 0.12, y: py + 0.6, w: mw - 0.24, h: 0.42, fontSize: 12, bold: true, color: K.text, align: "center", valign: "middle" });
    T(s, b, { x: x + 0.12, y: py + 1.02, w: mw - 0.24, h: 0.26, fontSize: 10, color: K.muted, align: "center", valign: "middle" });
  });
  node(5.5, "Investment thesis  ·  priorities  ·  cheque size  ·  geography", { color: K.muted });
  node(6.22, "Investor", { w: 2.2, bold: true, border: K.violet });
  // two-way flow
  [[2.66, 2.92], [3.38, 3.62], [5.24, 5.5], [5.96, 6.22]].forEach(([a, b]) => link(s, W / 2, a, W / 2, b, { color: K.indigo, width: 1.25, both: true }));
  // what each side gets
  const side = (x, al, head, lines) => {
    T(s, head, { x, y: 3.75, w: 2.4, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2, align: al });
    lines.forEach((l, i) => T(s, l, { x, y: 4.08 + i * 0.36, w: 2.4, h: 0.3, fontSize: 14, color: K.text, align: al }));
  };
  side(M, "left", "FOUNDERS GET", ["Readiness report", "Investors ranked by fit"]);
  side(W - M - 2.4, "right", "INVESTORS GET", ["Startups ranked by fit", "A reason per criterion"]);
  link(s, M + 2.5, 4.43, cx - 0.45, 4.43, { color: K.line2, width: 0.75, dash: "dash" });
  link(s, cx + cw + 0.45, 4.43, W - M - 2.5, 4.43, { color: K.line2, width: 0.75, dash: "dash" });
  s.addNotes(
    "VentureX sits between the two sides.\n" +
    "Founders bring a startup profile, pitch deck and documents (PDF, PPTX, DOCX and more) and optionally a public GitHub repository and demo link.\n" +
    "Investors bring an investment thesis: sectors, stages, cheque size, geography, traction and team requirements, plus how much each criterion matters to them.\n" +
    "The intelligence layer has four connected parts: (1) AI readiness, a private report for the founder; (2) explainable matching, a fit score with a reason for every criterion; (3) discovery in both directions, so founders find investors and investors find startups; (4) the deal room, a private space with chat, NDA, shared documents, deal stage and funding round.\n" +
    "Everything flows both ways: the same fit is shown to founders when they look for investors and to investors when they discover startups."
  );
}

// =====================================================================
// 04. THE FOUNDER EXPERIENCE
// =====================================================================
if (want(4)) {
  const s = slide();
  eyebrow(s, "03", "FOUNDERS");
  headline(s, "From uncertainty to investor readiness.");
  stepper(s, ["Register", "Build startup profile", "Upload deck and materials", "Evaluate readiness", "Discover relevant investors", "Request connections"], M, 2.2, 0.66, 3.4);
  const a = shot(s, "founder_dashboard.png", 2880, 920, 5.35, 2.05, 7.28, "Founder dashboard");
  const b = shot(s, "founder_find_investors.png", 2880, 1800, 7.25, 3.95, 4.2, "Founder: find investors ranked by fit");
  marker(s, "A", a.x + a.w * 0.565, a.y + a.h * 0.43);
  marker(s, "B", b.x + b.w * 0.543, b.y + b.h * 0.653);
  key(s, [["A", "Readiness at a glance"], ["B", "Investors ranked by fit"]], M, 6.15, { stack: true });
  s.addNotes(
    "The founder journey, all implemented: register (Neon Auth sign-in), build a startup profile, upload the pitch deck and materials, run the readiness evaluation, discover investors, and request intros.\n" +
    "Back screen: the founder dashboard with projects, best readiness score, investor matches and pending intros.\n" +
    "Front screen: Find investors. Investors are ranked by how well the founder's startup meets each investor's own criteria, with the reasons shown on each card.\n" +
    "Guard rails: intro requests unlock once a published project reaches a minimum readiness score (50), and verified companies get a higher daily limit. Investors answer Interested or Pass; unanswered requests expire after 14 days.\n" +
    "Screens are from the running app with demo data."
  );
}

// =====================================================================
// 05. THE INVESTOR EXPERIENCE
// =====================================================================
if (want(5)) {
  const s = slide();
  eyebrow(s, "04", "INVESTORS");
  headline(s, "Less noise. More relevant opportunities.");
  const a = shot(s, "investor_overview.png", 2880, 1360, M, 2.05, 6.9, "Investor overview: thesis and best fits");
  const b = shot(s, "match_priorities.png", 1480, 935, M + 4.5, 4.2, 2.95, "Investor criteria: match priorities");
  marker(s, "A", a.x + a.w * 0.17, a.y + a.h * 0.505);
  marker(s, "B", b.x + b.w * 0.6, b.y + b.h * 0.25);
  key(s, [["A", "Their own thesis"], ["B", "Their own priorities"]], M, 6.5);
  stepper(s, ["Register and verify", "Define investment thesis", "Set sector, stage, geography, cheque", "Discover startups", "Review matching reasons", "Express interest"], 8.15, 2.2, 0.66, 3.9, 14);
  s.addNotes(
    "Investors have their own workspace: overview, Discover, deal flow, portfolio and finances, company updates, firm (team accounts), criteria and verification.\n" +
    "Journey: register and get verified (an admin reviews evidence of investing activity; unverified investors can browse but not request intros), define the thesis across ten areas (sectors, stages, cheque size and total allocation, geography, traction, structure, team, IP and more), set how much each criterion matters (High, Medium, Low or Ignore), discover startups ranked by fit, read the reasons, and express interest.\n" +
    "Back screen: the investor overview, with the thesis summary and best fits. Front screen: the match priorities from the criteria page.\n" +
    "Discover starts from the saved criteria; changing filters never overwrites them. Screens use demo data."
  );
}

// =====================================================================
// 06. AI READINESS
// =====================================================================
if (want(6)) {
  const s = slide();
  eyebrow(s, "05", "AI READINESS");
  headline(s, "Know what investors will question before they do.");
  // five-dimension radar (native, editable chart) with the demo startup's scores
  const labels = ["Problem / solution", "Market & competition", "Business model", "Traction", "Product & tech"];
  s.addChart(pres.charts.RADAR, [{ name: "Demo startup", labels, values: [60, 40, 40, 35, 35] }], {
    x: M - 0.15, y: 1.85, w: 5.2, h: 3.2, radarStyle: "filled", chartColors: [K.indigo], chartColorsOpacity: 45,
    catAxisLabelColor: K.muted, catAxisLabelFontSize: 11, catAxisLabelFontFace: "Arial",
    valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25,
    valGridLine: { color: K.line2, size: 0.75 }, catGridLine: { color: K.line2, size: 0.75 },
    showLegend: false, showTitle: false, plotArea: { fill: { color: K.bg } },
  });
  T(s, "Five areas, scored 0–100  ·  demo startup", { x: M, y: 5.05, w: 4.9, h: 0.25, fontSize: 11, color: K.dim, align: "center" });
  const a = shot(s, "readiness.png", 2190, 1545, 6.3, 1.95, 6.33, "Readiness report");
  // outputs
  [["Overall score", "Strengths", "Gaps by severity"], ["Prioritised fixes", "Industry insights"]].forEach((row, r) => {
    let x = M;
    row.forEach((o) => { const w = 0.4 + o.length * 0.09; chip(s, o, x, 5.5 + r * 0.46, w); x += w + 0.12; });
  });
  rrect(s, { x: M, y: 6.42, w: 2.2, h: 0.36, rectRadius: 0.18, fill: { color: K.bg }, line: { color: K.green, width: 1 } });
  T(s, "Private to the founder", { x: M, y: 6.42, w: 2.2, h: 0.36, fontSize: 12, bold: true, color: K.green, align: "center", valign: "middle" });
  T(s, "Claude or Gemini when configured  ·  rule-based fallback (shown)", { x: a.x, y: a.bottom + 0.08, w: a.w, h: 0.22, fontSize: 10, color: K.dim, align: "right" });
  s.addNotes(
    "Verified in backend/app/services/analysis_service.py.\n" +
    "The readiness report reads everything the founder provides together: the startup profile, uploaded materials (pitch deck, business plan, research; PDF and images natively, other documents as extracted text), the public GitHub repository and the demo link.\n" +
    "It scores five dimensions from 0 to 100: problem/solution fit, market sizing and competition, business model clarity, traction and validation, and product and technology. It returns an overall score, strengths, gaps with a severity, prioritised recommendations and industry-specific insights. Every run is stored, so founders can see their history.\n" +
    "Engines: Anthropic Claude when ANTHROPIC_API_KEY is set, otherwise Google Gemini when GEMINI_API_KEY is set (with fallback models if one is overloaded), otherwise a transparent rule-based checker. Both AI engines use the same schema-constrained JSON contract. The rule-based result is labelled as such in the UI.\n" +
    "Important: the screenshot and the radar values come from the rule-based fallback, because no AI key is configured in our demo environment. We don't present it as an LLM evaluation.\n" +
    "Privacy: investors never see the readiness score. Drafts are never matched or announced to investors."
  );
}

// =====================================================================
// 07. EXPLAINABLE MATCHING
// =====================================================================
if (want(7)) {
  const s = slide();
  eyebrow(s, "06", "EXPLAINABLE MATCHING");
  headline(s, "Not just a match. A reason why.");
  // engine flow
  const lx = M, lw = 5.65;
  const box = (y, h, text, o = {}) => {
    rrect(s, { x: o.x ?? lx, y, w: o.w ?? lw, h, rectRadius: 0.06, fill: { color: o.fill || K.panel }, line: { color: o.border || K.line2, width: 0.75 } });
    if (text) T(s, text, { x: (o.x ?? lx) + 0.2, y, w: (o.w ?? lw) - 0.4, h, fontSize: o.size || 13, bold: !!o.bold, color: o.color || K.text, valign: "middle", align: o.align || "center" });
  };
  const half = (lw - 0.5) / 2;
  box(2.15, 0.5, "Startup profile", { w: half });
  T(s, "+", { x: lx + half, y: 2.15, w: 0.5, h: 0.5, fontSize: 18, bold: true, color: K.muted, align: "center", valign: "middle" });
  box(2.15, 0.5, "Investor thesis", { x: lx + half + 0.5, w: half });
  link(s, lx + lw / 2, 2.65, lx + lw / 2, 2.9, { color: K.indigo, arrow: true });
  box(2.9, 2.55, "", {});
  T(s, "Score each criterion 0–100, weight by the investor's priorities", { x: lx + 0.2, y: 2.98, w: lw - 0.4, h: 0.3, fontSize: 12, color: K.muted, align: "center" });
  const crit = [["Industry", 3], ["Stage", 3], ["Cheque size", 2], ["Geography", 2], ["Traction", 2], ["Team and IP", 2], ["Business model", 1]];
  crit.forEach(([c, w], i) => {
    const col = i < 4 ? 0 : 1, row = i < 4 ? i : i - 4, x = lx + 0.3 + col * (lw / 2), y = 3.42 + row * 0.47;
    T(s, c, { x, y, w: 1.5, h: 0.3, fontSize: 13, color: K.text, valign: "middle" });
    for (let k = 0; k < 3; k++) rect(s, { x: x + 1.55 + k * 0.3, y: y + 0.1, w: 0.24, h: 0.1, fill: { color: k < w ? K.indigo : K.line2 } });
  });
  link(s, lx + lw / 2, 5.45, lx + lw / 2, 5.7, { color: K.indigo, arrow: true });
  box(5.7, 0.55, "Fit score  +  a reason for every criterion", { fill: K.panel2, border: K.indigo, bold: true });
  T(s, "Default priorities shown  ·  exclusions remove a startup", { x: lx, y: 6.35, w: lw, h: 0.22, fontSize: 10, color: K.dim, align: "center" });
  // the real screen
  const a = shot(s, "match_reasons.png", 2240, 1110, 6.85, 2.15, 5.78, "Startup page: fit score with reasons");
  marker(s, "A", a.x + a.w * 0.81, a.y + a.h * 0.43);
  marker(s, "B", a.x + a.w * 0.012, a.y + a.h * 0.72);
  key(s, [["A", "Fit score"], ["B", "A reason per criterion"]], a.x, a.bottom + 0.3);
  s.addNotes(
    "Verified in backend/app/services/match_service.py and schemas/thesis.py.\n" +
    "Inputs: the startup profile and the investor's thesis. Each criterion is scored 0 to 100: industry (exact match, overlapping sector or matching technology), stage (one step away gets partial credit, 78), cheque size versus the raise, business model, and, only when the investor set them, geography, traction and team/IP.\n" +
    "Weights come from the investor's own priorities: High = 3, Medium = 2, Low = 1, Ignore = 0. Defaults: industry and stage High; cheque size, geography, traction and team Medium; business model Low. The fit is the weighted average, kept between 40 and 98.8; anything under 45 isn't recommended.\n" +
    "Hard exclusions remove a startup entirely: an excluded industry or country, or an unmet required traction or team requirement.\n" +
    "Every criterion returns a plain-language reason, as on the screen: industry focus, stage alignment, check size, geography, traction, business model.\n" +
    "Matching is deterministic and auditable; AI is used for the readiness report, not to hide how fit is calculated. Founders see the same scores against each investor's criteria on Find investors."
  );
}

// =====================================================================
// 08. WHAT MAKES VENTUREX DIFFERENT
// =====================================================================
if (want(8)) {
  const s = slide();
  eyebrow(s, "07", "WHY VENTUREX");
  headline(s, "The advantage isn't one feature. It's how everything works together.", { w: 11 });
  const stages = [["ASSESS", "AI readiness finds the gaps"], ["MATCH", "Ranked by the investor's own criteria"], ["EXPLAIN", "A reason for every criterion"], ["CONNECT", "Founder-approved intro opens a deal room"]];
  const y = 2.75, sw = CW / 4;
  link(s, M + 0.17, y + 0.17, M + 3 * sw + 0.17, y + 0.17, { color: K.indigo, width: 2 });
  stages.forEach(([a, b], i) => {
    const x = M + i * sw;
    circle(s, x + 0.17, y + 0.17, 0.34, { fill: { color: i === 3 ? K.indigo : K.bg }, line: { color: K.indigo, width: 2 } });
    T(s, "0" + (i + 1), { x, y: y - 0.4, w: 1, h: 0.3, fontSize: 11, bold: true, color: K.indigo, valign: "middle" });
    T(s, a, { x, y: y + 0.6, w: sw - 0.3, h: 0.55, fontSize: 26, bold: true, color: K.text });
    T(s, b, { x, y: y + 1.2, w: sw - 0.45, h: 0.7, fontSize: 15, color: K.muted });
  });
  link(s, M, 4.8, W - M, 4.8, { color: K.line, width: 0.75 });
  const hl = ["Private readiness reports", "Explainable weighted matching", "Founder-controlled introductions", "Integrated deal rooms", "Built for Indian rounds"];
  const hw = CW / hl.length;
  hl.forEach((t, i) => {
    const x = M + i * hw;
    if (i) link(s, x, 5.05, x, 5.85, { color: K.line, width: 0.75 });
    circle(s, x + (i ? 0.3 : 0) + 0.08, 5.17, 0.14, { fill: { color: K.violet } });
    T(s, t, { x: x + (i ? 0.3 : 0), y: 5.35, w: hw - 0.45, h: 0.55, fontSize: 14, color: K.text });
  });
  T(s, "Individual steps exist elsewhere (e.g. OpenVC deck scores and fit ranking; Gust data rooms for investor groups). Our focus is connecting them.",
    { x: M, y: 6.45, w: CW, h: 0.25, fontSize: 10, color: K.dim });
  s.addNotes(
    "Our differentiation is the combination, not exclusivity.\n" +
    "Assess: the private readiness report shows founders what to fix before they publish. Match: startups and investors are ranked by each investor's own criteria and priorities. Explain: every criterion comes with a plain-language reason. Connect: intros run both ways, but the founder always decides; accepting opens a private deal room with chat, NDA, shared documents, deal stage, funding round and an audit log.\n" +
    "Built for Indian rounds: amounts in rupees with lakh/crore formatting, company verification by company email domain or registration number (GSTIN, CIN), funding rounds that separate committed from received capital with exact decimal maths, and agreed versus indicative ownership.\n" +
    "Competitor basis (public product, pricing and help-centre pages, reviewed Nov 2026; no signed-in dashboards inspected): OpenVC has an AI deck score, a Fundability test and investor search ranked by fit, but no data room. Gust has a benchmarking tool, directory filters and data rooms for investor groups. F6S is an accelerator and grant application marketplace with a pipeline CRM. Wellfound is now a hiring platform with no fundraising product. We did not find per-criterion fit reasons weighted by investor priorities documented elsewhere."
  );
}

// =====================================================================
// 09. ARCHITECTURE
// =====================================================================
if (want(9)) {
  const s = slide("VX Glow");
  eyebrow(s, "08", "ARCHITECTURE");
  headline(s, "Engineered as a complete, modular technology platform.", { size: 30 });
  const cx = 3.05, cw = 6.55; // core column
  const layer = (y, h, tag, text, o = {}) => {
    rrect(s, { x: cx, y, w: cw, h, rectRadius: 0.06, fill: { color: o.fill || K.panel }, line: { color: o.border || K.line2, width: 0.75 } });
    T(s, tag, { x: cx + 0.22, y, w: 1.5, h, fontSize: 10, bold: true, color: o.tagColor || K.muted, charSpacing: 2, valign: "middle" });
    T(s, text, { x: cx + 1.75, y, w: cw - 1.95, h, fontSize: 14, color: K.text, valign: "middle" });
  };
  // users
  [["Founder", cx + cw / 2 - 1.55], ["Investor", cx + cw / 2 + 0.15]].forEach(([t, x]) => {
    rrect(s, { x, y: 2.1, w: 1.4, h: 0.4, rectRadius: 0.2, fill: { color: K.panel2 }, line: { color: K.indigo, width: 1 } });
    T(s, t, { x, y: 2.1, w: 1.4, h: 0.4, fontSize: 13, bold: true, align: "center", valign: "middle" });
  });
  const down = (y1, y2) => link(s, cx + cw / 2, y1, cx + cw / 2, y2, { color: K.indigo, width: 1.25, arrow: true });
  down(2.5, 2.72);
  layer(2.72, 0.56, "FRONTEND", "Next.js 16  ·  React 19  ·  Tailwind CSS 4");
  down(3.28, 3.5);
  layer(3.5, 0.56, "BACKEND", "Python  ·  FastAPI  ·  Pydantic  ·  " + FACTS.endpoints + " endpoints", { fill: K.panel2, border: K.indigo, tagColor: K.violet });
  // services
  const svc = ["AI readiness", "Matching engine", "Auth & access", "Deal rooms & docs", "Integrations"];
  const sy = 4.32, sh = 0.72, sgap = 0.1, sw = (cw - 4 * sgap) / 5;
  link(s, cx + sw / 2, 4.2, cx + cw - sw / 2, 4.2, { color: K.line2, width: 1 });
  link(s, cx + cw / 2, 4.06, cx + cw / 2, 4.2, { color: K.line2, width: 1 });
  svc.forEach((t, i) => {
    const x = cx + i * (sw + sgap);
    link(s, x + sw / 2, 4.2, x + sw / 2, sy, { color: K.line2, width: 1 });
    rrect(s, { x, y: sy, w: sw, h: sh, rectRadius: 0.06, fill: { color: K.panel }, line: { color: K.line2, width: 0.75 } });
    T(s, t, { x: x + 0.06, y: sy, w: sw - 0.12, h: sh, fontSize: 11, bold: true, align: "center", valign: "middle" });
  });
  down(5.04, 5.3);
  layer(5.3, 0.56, "DATABASE", "Neon PostgreSQL  ·  " + FACTS.tables + " relational tables");
  // external services (right)
  const ex = 10.25, ew = W - M - ex;
  T(s, "EXTERNAL SERVICES", { x: ex, y: 2.15, w: ew, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2 });
  const ext = [["Neon Auth", "Better Auth · signed JWT"], ["Anthropic Claude", "readiness analysis"], ["Google Gemini", "readiness analysis"], ["GitHub API", "repository intake"], ["SMTP email", "notifications"]];
  const ey0 = 2.5, eh = 0.56, eg = 0.12;
  const busX = ex - 0.3;
  link(s, busX, ey0 + eh / 2, busX, ey0 + 4 * (eh + eg) + eh / 2, { color: K.line2, width: 1, dash: "dash" });
  link(s, cx + cw, 3.78, busX, 3.78, { color: K.line2, width: 1, dash: "dash" });
  ext.forEach(([a, b], i) => {
    const y = ey0 + i * (eh + eg);
    link(s, busX, y + eh / 2, ex, y + eh / 2, { color: K.line2, width: 1, dash: "dash" });
    rrect(s, { x: ex, y, w: ew, h: eh, rectRadius: 0.06, fill: { color: K.panel }, line: { color: K.line2, width: 0.75 } });
    T(s, a, { x: ex + 0.15, y: y + 0.06, w: ew - 0.3, h: 0.24, fontSize: 12, bold: true });
    T(s, b, { x: ex + 0.15, y: y + 0.3, w: ew - 0.3, h: 0.2, fontSize: 10, color: K.muted });
  });
  // delivery (left)
  const dw = cx - 0.35 - M;
  T(s, "DELIVERY", { x: M, y: 2.15, w: dw, h: 0.22, fontSize: 10, bold: true, color: K.muted, charSpacing: 2 });
  [["Docker", "container images"], ["Render", "deployment blueprint"], ["Private storage", "decks & deal-room files"], ["Testing", "pytest · Playwright"]].forEach(([a, b], i) => {
    const y = 2.5 + i * 0.68;
    rrect(s, { x: M, y, w: dw, h: 0.56, rectRadius: 0.06, fill: { color: K.panel }, line: { color: K.line2, width: 0.75 } });
    T(s, a, { x: M + 0.15, y: y + 0.06, w: dw - 0.3, h: 0.24, fontSize: 12, bold: true });
    T(s, b, { x: M + 0.15, y: y + 0.3, w: dw - 0.3, h: 0.2, fontSize: 10, color: K.muted });
  });
  T(s, "Verified from source: frontend/package.json, backend/requirements.txt, schema.sql, render.yaml", { x: M, y: 6.45, w: CW, h: 0.22, fontSize: 9, color: K.dim });
  s.addNotes(
    "Every item here was checked in the code.\n" +
    "Frontend: Next.js 16.3 (App Router), React 19.2, Tailwind CSS 4. The browser signs in through Neon Auth and sends a short-lived signed token with every API call.\n" +
    "Backend: Python with FastAPI and Pydantic v2, " + FACTS.routeModules + " route modules and " + FACTS.endpoints + " endpoints. The API verifies each token against Neon Auth's published keys (JWKS) and applies role checks (founder, investor, admin) and team access.\n" +
    "Services: the AI readiness engine (Claude, Gemini or the rule-based fallback), the deterministic matching engine, auth and access control, deal rooms with NDA, documents and an audit trail, funding rounds, notifications, and integrations.\n" +
    "Database: Neon PostgreSQL with " + FACTS.tables + " tables, accessed with psycopg 3; the schema is applied idempotently at startup; money is stored as exact decimals; multi-step writes are atomic.\n" +
    "External services: Neon Auth (Better Auth), Anthropic Claude and Google Gemini (used only when an API key is configured), the GitHub API for repository intake, and SMTP email (written to a log until SMTP is configured).\n" +
    "Delivery: Docker, and a Render blueprint (render.yaml) that deploys the API and web app with a persistent disk for private files. The blueprint is ready; the app has not yet been deployed publicly."
  );
}

// =====================================================================
// 10. ENGINEERING
// =====================================================================
if (want(10)) {
  const s = slide();
  eyebrow(s, "09", "ENGINEERING");
  headline(s, "More than a prototype. A tested, integrated system.");
  const metrics = [[BACKEND_TESTS, "backend tests", "pytest"], [String(FACTS.browserSuites), "browser test suites", "Playwright"], [String(FACTS.apiFlowChecks), "API flow checks", "end to end"], [String(FACTS.endpoints), "API endpoints", FACTS.routeModules + " modules"], [String(FACTS.tables), "database tables", "PostgreSQL"]];
  const mw = CW / 5;
  metrics.forEach(([n, a, b], i) => {
    const x = M + i * mw;
    if (i) link(s, x, 2.25, x, 3.55, { color: K.line, width: 0.75 });
    T(s, n, { x: x + (i ? 0.3 : 0), y: 2.15, w: mw - 0.3, h: 0.75, fontSize: 44, bold: true, color: i < 3 ? K.text : K.violet });
    T(s, a, { x: x + (i ? 0.3 : 0), y: 2.95, w: mw - 0.3, h: 0.28, fontSize: 14, color: K.text });
    T(s, b, { x: x + (i ? 0.3 : 0), y: 3.23, w: mw - 0.3, h: 0.25, fontSize: 11, color: K.dim });
  });
  const caps = ["Separate founder & investor portals", "Role checks on signed tokens", "Relational schema, exact money",
    "Explainable matching engine", "AI with a rule-based fallback", "Private deal rooms with NDAs",
    "Documents: PDF, PPTX, DOCX", "Audit trails and atomic writes", "Unit, API and browser tests"];
  const gx = M, gy = 4.05, cw3 = CW / 3, rh = 0.62;
  rrect(s, { x: gx, y: gy, w: CW, h: rh * 3, rectRadius: 0.06, fill: { color: K.panel }, line: { color: K.line2, width: 0.75 } });
  [1, 2].forEach((r) => link(s, gx, gy + r * rh, gx + CW, gy + r * rh, { color: K.line, width: 0.75 }));
  [1, 2].forEach((c) => link(s, gx + c * cw3, gy, gx + c * cw3, gy + 3 * rh, { color: K.line, width: 0.75 }));
  caps.forEach((t, i) => {
    const r = Math.floor(i / 3), c = i % 3, x = gx + c * cw3, y = gy + r * rh;
    circle(s, x + 0.32, y + rh / 2, 0.16, { fill: { color: K.indigo } });
    T(s, t, { x: x + 0.55, y, w: cw3 - 0.7, h: rh, fontSize: 14, color: K.text, valign: "middle" });
  });
  const areas = ["Product", "Frontend", "Backend", "Database", "AI", "Testing"];
  let ax = M;
  T(s, "Built across", { x: ax, y: 6.2, w: 1.2, h: 0.36, fontSize: 12, color: K.dim, valign: "middle" });
  ax += 1.25;
  areas.forEach((a) => { const w = 0.3 + a.length * 0.1; chip(s, a, ax, 6.2, w, { size: 11, color: K.muted }); ax += w + 0.1; });
  s.addNotes(
    "Numbers are from our latest runs (24 Nov 2026): " + BACKEND_TESTS + " backend tests passing (pytest), the full API flow with " + FACTS.apiFlowChecks + " checks passing, and seven Playwright browser suites (founder outreach, investor portal, verification, investor updates, teams, profiles and funding, portfolio CSV) that drive the real app in Chrome with test accounts. The API has " + FACTS.endpoints + " endpoints across " + FACTS.routeModules + " route modules, and the schema has " + FACTS.tables + " tables.\n" +
    "Engineering highlights: separate founder and investor portals with role checks on every request; signed-token verification; a relational schema with exact decimal money; an explainable, deterministic matching engine; AI integration with two providers and a rule-based fallback; private deal rooms with NDA signing, documents and an audit trail; document intake for PDF, PPTX, DOCX and images; atomic multi-step writes with audit events for funding rounds.\n" +
    "What we don't claim: no security certification, and it isn't deployed publicly yet. Emails are written to a log until SMTP is configured, and there is no background scheduler yet."
  );
}

// =====================================================================
// 11. THE LIVE EXPERIENCE
// =====================================================================
if (want(11)) {
  const s = slide("VX Close");
  eyebrow(s, "10", "LIVE DEMO");
  headline(s, "Enough about the idea. Let's experience VentureX.", { w: 11 });
  // a product window holding both journeys
  const wx = M, wy = 2.15, ww = CW, wh = 2.45;
  rrect(s, { x: wx, y: wy, w: ww, h: wh, rectRadius: 0.08, fill: { color: K.panel }, line: { color: K.line2, width: 0.75 },
    shadow: { type: "outer", color: "000000", opacity: 0.5, blur: 20, offset: 6, angle: 90 } });
  link(s, wx, wy + 0.34, wx + ww, wy + 0.34, { color: K.line, width: 0.75 });
  [0, 1, 2].forEach((i) => circle(s, wx + 0.22 + i * 0.16, wy + 0.17, 0.09, { fill: { color: K.line2 } }));
  rrect(s, { x: wx + ww / 2 - 1.3, y: wy + 0.07, w: 2.6, h: 0.2, rectRadius: 0.1, fill: { color: K.panel2 } });
  T(s, "VentureX  ·  live", { x: wx + ww / 2 - 1.3, y: wy + 0.07, w: 2.6, h: 0.2, fontSize: 9, color: K.muted, align: "center", valign: "middle" });
  const lanes = [["FOUNDER", ["Readiness", "Matching", "Connections"], K.indigo], ["INVESTOR", ["Investment thesis", "Startup discovery", "Deal room"], K.violet]];
  lanes.forEach(([who, steps, col], r) => {
    const y = wy + 0.68 + r * 0.82;
    T(s, who, { x: wx + 0.35, y, w: 1.6, h: 0.44, fontSize: 11, bold: true, color: K.muted, charSpacing: 2, valign: "middle" });
    const nx0 = wx + 2.3, nw = 2.6, ng = 0.75;
    steps.forEach((t, i) => {
      const x = nx0 + i * (nw + ng);
      rrect(s, { x, y, w: nw, h: 0.44, rectRadius: 0.22, fill: { color: K.panel2 }, line: { color: col, width: 1 } });
      T(s, t, { x, y, w: nw, h: 0.44, fontSize: 14, bold: true, align: "center", valign: "middle" });
      if (i < steps.length - 1) link(s, x + nw + 0.12, y + 0.22, x + nw + ng - 0.12, y + 0.22, { color: col, width: 1.25, arrow: true });
    });
  });
  mark(s, M, 5.15, 0.3);
  T(s, "VentureX", { x: M + 0.62, y: 5.13, w: 3, h: 0.4, fontSize: 18, bold: true, valign: "middle" });
  T(s, [{ text: "Ready startups. ", options: {} }, { text: "Right investors.", options: { color: K.violet } }],
    { x: M, y: 5.6, w: CW, h: 0.75, fontSize: 40, bold: true });
  T(s, "Anshitha Yeruva  |  Nitya Nara", { x: M, y: 6.6, w: 6, h: 0.3, fontSize: 13, color: K.dim });
  s.addNotes(
    "Hand-off to the live demo (switch to the website, demo data only).\n" +
    "Founder path: open the startup profile and materials; run or show the readiness report (scores, gaps, prioritised fixes); open Find investors to see investors ranked by fit with reasons; request an intro.\n" +
    "Investor path: show the investment thesis and priorities; open Discover, which starts from the saved criteria; open a startup to see the fit score and its reasons; express interest.\n" +
    "Then accept the intro as the founder and open the deal room: chat, NDA, shared documents, deal stage and funding round.\n" +
    "Close: 'Ready startups. Right investors.' Thank you."
  );
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT, ONLY.length ? "(slides " + ONLY.join(",") + ")" : "");
})();
