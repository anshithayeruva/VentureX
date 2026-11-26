// Builds pitch-deck/VentureX_Pitch_Deck.pptx: an 8-slide visual pitch that leads into a live demo.
//   cd pitch-deck/src && npm install && node build_deck.js
// Slides carry headlines and visuals only; the explanation, sources and caveats live in the speaker notes.
// Everything is drawn with native PowerPoint shapes so it stays editable.
// The earlier 15-slide version is kept in build_deck_v1.js (writes to pitch-deck/v1/).
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require("./apply_theme.js");

const ROOT = path.resolve(__dirname, "..");
const SHOT = (f) => path.join(ROOT, "assets", "screens", f);
const OUT = process.env.VX_OUT || path.join(ROOT, "VentureX_Pitch_Deck.pptx");

const THEME = {
  name: "VentureX",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "0E1A2B", lt1: "FFFFFF", dk2: "4B5567", lt2: "F3F4F6",
    accent1: "2D5BD8", accent2: "DCE4F8", accent3: "8A93A3", accent4: "E3E6EB",
    accent5: "0F7A55", accent6: "9A5B13", hlink: "2D5BD8", folHlink: "4B5567",
  },
};
const HEX = THEME.colors;
const SOFT = "8FA9F0"; // light blue on navy
const MUTED_ON_DARK = "C9D2E3";
const LINE_ON_DARK = "33425E";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.author = "Anshitha Yeruva, Nitya Nara";
pres.title = "VentureX: Get investor-ready. Meet investors who fit.";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333, M = 0.7, CW = W - 2 * M;

// ---------- layouts ----------
pres.defineSlideMaster({ title: "VX Dark", background: { color: HEX.dk1 }, objects: [] });
pres.defineSlideMaster({
  title: "VX Light",
  background: { color: HEX.lt1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.6, w: CW, h: 0.9, fontSize: 34, bold: true, color: C.text1, margin: 0, valign: "top", align: "left", fontFace: "Arial" }, text: "" } },
    { text: { text: "VentureX", options: { x: M, y: 7.0, w: 3, h: 0.25, fontSize: 10, bold: true, color: C.accent3, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.0, w: 0.6, h: 0.25, fontSize: 10, color: C.accent3, align: "right", margin: 0 },
});

// ---------- helpers ----------
const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, fontSize: 16, color: C.text1, valign: "top", ...o });
const rect = (s, o) => s.addShape(pres.shapes.RECTANGLE, { line: { type: "none" }, ...o });
const rrect = (s, o) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { rectRadius: 0.1, line: { type: "none" }, ...o });
const circle = (s, cx, cy, d, o) => s.addShape(pres.shapes.OVAL, { x: cx - d / 2, y: cy - d / 2, w: d, h: d, line: { type: "none" }, ...o });
// Straight connector between two points (normalised: OOXML extents can't be negative).
const link = (s, x1, y1, x2, y2, o = {}) => {
  const { color = HEX.accent4, width = 1.25, arrow = false, dash } = o;
  const line = { color, width };
  if (dash) line.dashType = dash;
  if (arrow) line.endArrowType = "triangle";
  s.addShape(pres.shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1, line,
  });
};
const source = (s, text) => T(s, text, { x: M, y: 6.55, w: CW - 1, h: 0.3, fontSize: 10, color: C.accent3, valign: "bottom" });
const light = (title, section) => {
  const s = pres.addSlide({ masterName: "VX Light", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  return s;
};

// =====================================================================
// 1. COVER: two sides connecting through VentureX
// =====================================================================
pres.addSection({ title: "Why" });
{
  const s = pres.addSlide({ masterName: "VX Dark", sectionTitle: "Why" });
  T(s, "VentureX", { x: M, y: 1.35, w: 6, h: 0.45, fontSize: 20, bold: true, color: C.background1, charSpacing: 1 });
  T(s, [
    { text: "Get investor-ready.", options: { breakLine: true } },
    { text: "Meet investors who fit.", options: { color: SOFT } },
  ], { x: M, y: 2.15, w: 7.6, h: 1.7, fontSize: 44, bold: true, color: C.background1 });
  T(s, "AI-powered startup readiness and investor matching", { x: M, y: 4.1, w: 7.4, h: 0.4, fontSize: 18, color: MUTED_ON_DARK });
  T(s, "Anshitha Yeruva  |  Nitya Nara", { x: M, y: 6.3, w: 6, h: 0.3, fontSize: 14, color: "7D879A" });

  // network: founders (left) -> VentureX (centre) <- investors (right)
  const hubX = 10.45, hubY = 3.55, lx = 8.75, rx = 12.15;
  const ys = [2.15, 3.08, 4.02, 4.95];
  ys.forEach((y) => { link(s, lx, y, hubX, hubY, { color: LINE_ON_DARK }); link(s, rx, y, hubX, hubY, { color: LINE_ON_DARK }); });
  ys.forEach((y) => {
    circle(s, lx, y, 0.34, { fill: { color: SOFT } });
    circle(s, rx, y, 0.34, { fill: { color: HEX.dk1 }, line: { color: HEX.lt1, width: 1.5 } });
  });
  circle(s, hubX, hubY, 1.55, { fill: { color: HEX.accent1, transparency: 80 } });
  circle(s, hubX, hubY, 1.05, { fill: { color: HEX.accent1 } });
  T(s, "VX", { x: hubX - 0.5, y: hubY - 0.25, w: 1.0, h: 0.5, fontSize: 22, bold: true, color: C.background1, align: "center", valign: "middle" });
  T(s, "Founders", { x: lx - 0.8, y: 5.4, w: 1.6, h: 0.3, fontSize: 12, color: SOFT, align: "center" });
  T(s, "Investors", { x: rx - 0.8, y: 5.4, w: 1.6, h: 0.3, fontSize: 12, color: MUTED_ON_DARK, align: "center" });
  s.addNotes(
    "Opening (about 20 seconds).\n" +
    "VentureX is an AI-powered startup readiness and investor matching platform.\n" +
    "Founders find out how investor-ready they are and which investors actually fit them. Investors see startups that match their own thesis, with the reason for every match.\n" +
    "The picture says it: two sides of the funding ecosystem that today search for each other separately, connected through one platform.\n" +
    "Presenters: Anshitha Yeruva and Nitya Nara."
  );
}

// =====================================================================
// 2. THE PROBLEM: split screen
// =====================================================================
{
  const s = light("Two sides. One frustrating disconnect.", "Why");
  const y = 1.75, h = 4.6, gap = 0.5, pw = (CW - gap) / 2;
  const sides = [
    { x: M, fill: HEX.lt2, label: "FOUNDERS", q: "“Who should I pitch?”", pts: ["Endless investor research", "Uncertain readiness", "Repeated rejections"], dark: false },
    { x: M + pw + gap, fill: HEX.dk1, label: "INVESTORS", q: "“Which startup actually fits?”", pts: ["Too many pitches", "Irrelevant opportunities", "Slow screening"], dark: true },
  ];
  sides.forEach((sd) => {
    const ink = sd.dark ? HEX.lt1 : HEX.dk1, sub = sd.dark ? MUTED_ON_DARK : HEX.dk2, acc = sd.dark ? SOFT : HEX.accent1;
    rrect(s, { x: sd.x, y, w: pw, h, fill: { color: sd.fill } });
    T(s, sd.label, { x: sd.x + 0.45, y: y + 0.4, w: 3, h: 0.3, fontSize: 12, bold: true, color: acc, charSpacing: 3 });
    T(s, sd.q, { x: sd.x + 0.45, y: y + 0.8, w: pw - 0.7, h: 0.6, fontSize: 25, bold: true, color: ink });
    // a fanned stack: profiles to sift through (founders) or decks piling up (investors)
    const sx = sd.x + 0.45, sy = y + 1.85, cw = 1.45, ch = 0.98;
    for (let i = 4; i >= 0; i--) {
      const cx = sx + i * 0.13, cy = sy + i * 0.13;
      rrect(s, { x: cx, y: cy, w: cw, h: ch, rectRadius: 0.08, fill: { color: sd.dark ? (i === 0 ? "1F2E4A" : "16233A") : (i === 0 ? HEX.lt1 : "E8EAEE") },
        line: { color: sd.dark ? "2A3A58" : "D5D9E0", width: 0.75 } });
    }
    rect(s, { x: sx + 0.17, y: sy + 0.22, w: 0.75, h: 0.08, fill: { color: sd.dark ? "3A4A66" : "C9CED8" } });
    rect(s, { x: sx + 0.17, y: sy + 0.4, w: 1.05, h: 0.06, fill: { color: sd.dark ? "2E3D59" : "DCE0E6" } });
    rect(s, { x: sx + 0.17, y: sy + 0.53, w: 0.85, h: 0.06, fill: { color: sd.dark ? "2E3D59" : "DCE0E6" } });
    circle(s, sx + 1.18, sy + 0.7, 0.38, { fill: { color: acc } });
    T(s, "?", { x: sx + 0.99, y: sy + 0.51, w: 0.38, h: 0.38, fontSize: 16, bold: true, color: sd.dark ? HEX.dk1 : HEX.lt1, align: "center", valign: "middle" });
    sd.pts.forEach((p, i) => {
      const py = y + 1.95 + i * 0.6;
      circle(s, sd.x + 2.75, py + 0.16, 0.12, { fill: { color: acc } });
      T(s, p, { x: sd.x + 2.95, y: py, w: pw - 3.1, h: 0.32, fontSize: 16, color: sub, valign: "middle" });
    });
  });
  // the broken link between the two sides
  const cy = y + h / 2, cx = M + pw + gap / 2;
  circle(s, cx, cy, 0.46, { fill: { color: HEX.lt1 }, line: { color: HEX.accent4, width: 1 } });
  T(s, "×", { x: cx - 0.23, y: cy - 0.24, w: 0.46, h: 0.46, fontSize: 20, bold: true, color: C.accent3, align: "center", valign: "middle" });
  s.addNotes(
    "The problem (about 30 seconds).\n" +
    "Founders: investor research is manual, one list and one cold email at a time. Stage, sector and cheque size are rarely clear up front, so founders don't know who fits. They also can't tell whether their deck, market sizing or traction is strong enough, and rejections rarely say what was missing.\n" +
    "Investors: most inbound pitches fall outside the thesis. Every startup describes itself differently, so screening takes partner time before any real conversation.\n" +
    "Both sides are searching for each other, and both waste time on conversations that were never a fit.\n" +
    "(These are qualitative problem statements, not survey results.)"
  );
}

// =====================================================================
// 3. THE OPPORTUNITY: two enormous numbers, separate visuals
// =====================================================================
{
  const s = light("India has the startups. Finding the right capital is the hard part.", "Why");
  const colW = (CW - 0.8) / 2, x2 = M + colW + 0.8;
  link(s, M + colW + 0.4, 2.1, M + colW + 0.4, 6.1, { color: HEX.accent4, width: 1 });
  // left: recognised startups + dot grid (each dot = 1,000)
  T(s, "2,07,135", { x: M, y: 1.95, w: colW, h: 1.3, fontSize: 88, bold: true, color: C.text1 });
  T(s, "DPIIT-recognised startups", { x: M, y: 3.5, w: colW, h: 0.4, fontSize: 20, color: C.text2 });
  const cols = 30, d = 0.1, g = 0.075;
  for (let i = 0; i < 207; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    circle(s, M + d / 2 + c * (d + g), 4.35 + d / 2 + r * (d + g), d, { fill: { color: HEX.dk1 } });
  }
  T(s, "each dot ≈ 1,000 startups", { x: M, y: 5.7, w: colW, h: 0.3, fontSize: 12, color: C.accent3 });
  // right: funding rounds + year-on-year drop
  T(s, "1,518", { x: x2, y: 1.95, w: colW, h: 1.3, fontSize: 88, bold: true, color: C.accent1 });
  T(s, "tech funding rounds in 2025", { x: x2, y: 3.5, w: colW, h: 0.4, fontSize: 20, color: C.text2 });
  s.addShape(pres.shapes.DOWN_ARROW, { x: x2, y: 4.35, w: 0.55, h: 0.75, fill: { color: HEX.accent1 }, line: { type: "none" } });
  T(s, "39%", { x: x2 + 0.75, y: 4.25, w: 2.5, h: 0.8, fontSize: 44, bold: true, color: C.accent1, valign: "middle" });
  T(s, "fewer rounds than 2024", { x: x2 + 0.75, y: 5.05, w: 4, h: 0.35, fontSize: 16, color: C.text2 });
  source(s, "Sources: Ministry of Commerce & Industry, as of 31 Dec 2025 (via The Tribune); Tracxn India Tech 2025 (via TechCrunch, 27 Dec 2025). Separate datasets.");
  s.addNotes(
    "The opportunity (about 30 seconds).\n" +
    "India had 2,07,135 DPIIT-recognised startups as of 31 December 2025 (Ministry of Commerce & Industry, written reply in the Rajya Sabha, reported by The Tribune).\n" +
    "Meanwhile, according to Tracxn's 2025 India Tech data reported by TechCrunch on 27 Dec 2025: 1,518 funding rounds, down about 39% from 2024; seed funding of $1.1B, down 30%; and roughly 3,170 investors took part in rounds, down 53% from about 6,800.\n" +
    "These are two different datasets (all recognised startups vs. tech rounds tracked by Tracxn), so don't divide one by the other. The point: a large and growing pool of startups, and capital that is getting more selective. When investors are writing fewer cheques, both sides need to find the right match faster."
  );
}

// =====================================================================
// 4. THE SOLUTION: ecosystem diagram
// =====================================================================
pres.addSection({ title: "What" });
{
  const s = light("What if both sides could find each other intelligently?", "What");
  const cy = 4.45, hubX = W / 2;
  circle(s, hubX, cy, 3.9, { fill: { color: HEX.accent2, transparency: 35 }, line: { color: HEX.accent1, width: 1.25, dashType: "dash" } });
  const caps = [
    { x: hubX, y: cy - 0.72, t: "AI readiness" },
    { x: hubX - 0.95, y: cy + 0.85, t: "Explainable\nmatching" },
    { x: hubX + 0.95, y: cy + 0.85, t: "Private\ndeal room" },
  ];
  [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => link(s, caps[a].x, caps[a].y, caps[b].x, caps[b].y, { color: HEX.accent1, width: 1.5 }));
  caps.forEach((c, i) => {
    circle(s, c.x, c.y, 1.12, { fill: { color: i === 0 ? HEX.accent1 : HEX.dk1 } });
    T(s, c.t, { x: c.x - 0.6, y: c.y - 0.4, w: 1.2, h: 0.8, fontSize: 12, bold: true, color: C.background1, align: "center", valign: "middle" });
  });
  T(s, "VentureX", { x: hubX - 1.2, y: cy - 1.72, w: 2.4, h: 0.35, fontSize: 16, bold: true, color: C.accent1, align: "center" });
  const side = (x, label, sub, dark) => {
    circle(s, x, cy, 1.55, { fill: { color: dark ? HEX.dk1 : HEX.lt2 }, line: dark ? { type: "none" } : { color: HEX.accent4, width: 1 } });
    T(s, label, { x: x - 0.8, y: cy - 0.2, w: 1.6, h: 0.4, fontSize: 17, bold: true, color: dark ? C.background1 : C.text1, align: "center", valign: "middle" });
    T(s, sub, { x: x - 1.3, y: cy + 0.95, w: 2.6, h: 0.35, fontSize: 14, color: C.text2, align: "center" });
  };
  const fx = M + 1.1, ix = W - M - 1.1;
  side(fx, "Founders", "get ready, find fit", false);
  side(ix, "Investors", "see fit, with reasons", true);
  // two-way flows between each side and the hub
  link(s, fx + 0.85, cy - 0.12, hubX - 2.05, cy - 0.12, { color: HEX.accent3, width: 1.5, arrow: true });
  link(s, hubX - 2.05, cy + 0.12, fx + 0.85, cy + 0.12, { color: HEX.accent3, width: 1.5, arrow: true });
  link(s, ix - 0.85, cy - 0.12, hubX + 2.05, cy - 0.12, { color: HEX.accent3, width: 1.5, arrow: true });
  link(s, hubX + 2.05, cy + 0.12, ix - 0.85, cy + 0.12, { color: HEX.accent3, width: 1.5, arrow: true });
  s.addNotes(
    "The solution (about 40 seconds).\n" +
    "VentureX sits between the two sides with three connected capabilities:\n" +
    "1. AI readiness: the founder's private report. It reads the startup profile, pitch deck, documents and public GitHub repository, scores five areas (problem/solution fit, market sizing and competition, business model, traction, product and technology) and lists gaps and prioritised fixes. Powered by Claude or Gemini when an API key is configured, with a transparent rule-based fallback. Investors never see this score.\n" +
    "2. Explainable matching: investors set their own thesis (sectors, stages, cheque size, geography, traction, team) and how much each criterion matters. Every startup gets a fit score with a plain-language reason for each criterion. Founders see the same fit from their side when they look for investors.\n" +
    "3. Private deal room: when the founder accepts an intro, a room opens with chat, NDA, shared documents, deal stage, funding round tracking and an audit log.\n" +
    "Founders get ready and find fit; investors see fit, with the reasons. We'll show all three live in a moment."
  );
}

// =====================================================================
// 5. THE DIFFERENTIATION: connected journey vs. single steps
// =====================================================================
{
  const s = light("Others solve a step. We connect the journey.", "What");
  const steps = ["Readiness", "Investor fit", "Explained match", "Deal room"];
  const x0 = M + 3.0, step = (CW - 3.0 - 0.6) / 3, top = 2.0;
  steps.forEach((t, i) => T(s, t, { x: x0 + i * step - 1.1, y: top, w: 2.2, h: 0.35, fontSize: 16, bold: true, align: "center", color: C.text1 }));
  const rows = [
    ["OpenVC", ["full", "full", "none", "none"]],
    ["Gust", ["part", "part", "none", "full"]],
    ["F6S", ["none", "part", "none", "none"]],
    ["Wellfound", ["none", "none", "none", "none"]],
  ];
  const dot = (x, y, kind, d = 0.3) => {
    if (kind === "full") circle(s, x, y, d, { fill: { color: HEX.accent3 } });
    else if (kind === "part") circle(s, x, y, d, { fill: { color: HEX.accent4 }, line: { color: HEX.accent3, width: 1.25 } });
    else circle(s, x, y, d, { fill: { color: HEX.lt1 }, line: { color: HEX.accent4, width: 1.25 } });
  };
  rows.forEach(([name, kinds], r) => {
    const y = top + 0.95 + r * 0.58;
    T(s, name, { x: M + 0.2, y: y - 0.17, w: 2.2, h: 0.34, fontSize: 15, color: C.accent3, valign: "middle" });
    kinds.forEach((k, i) => dot(x0 + i * step, y, k));
  });
  // VentureX: all four, connected
  const vy = top + 0.95 + 4 * 0.58 + 0.4;
  rrect(s, { x: M, y: vy - 0.48, w: CW, h: 0.96, fill: { color: HEX.accent2, transparency: 30 } });
  link(s, x0, vy, x0 + 3 * step, vy, { color: HEX.accent1, width: 3 });
  T(s, "VentureX", { x: M + 0.2, y: vy - 0.2, w: 2.2, h: 0.4, fontSize: 18, bold: true, color: C.accent1, valign: "middle" });
  steps.forEach((_, i) => circle(s, x0 + i * step, vy, 0.42, { fill: { color: HEX.accent1 }, line: { color: HEX.lt1, width: 2 } }));
  // legend
  const ly = 6.45;
  dot(M + 0.1, ly + 0.12, "full", 0.2); T(s, "publicly documented", { x: M + 0.3, y: ly, w: 2.2, h: 0.25, fontSize: 11, color: C.accent3, valign: "middle" });
  dot(M + 2.4, ly + 0.12, "part", 0.2); T(s, "partial", { x: M + 2.6, y: ly, w: 1.2, h: 0.25, fontSize: 11, color: C.accent3, valign: "middle" });
  dot(M + 3.5, ly + 0.12, "none", 0.2); T(s, "not found in public docs (Nov 2026)", { x: M + 3.7, y: ly, w: 4, h: 0.25, fontSize: 11, color: C.accent3, valign: "middle" });
  s.addNotes(
    "Differentiation (about 40 seconds).\n" +
    "We don't claim any single step is unique. OpenVC already scores pitch decks (an AI deck score and a Fundability test) and ranks investors by fit. Gust offers a benchmarking tool, directory filters (location, industry, keyword) and data rooms for investor groups. F6S is mainly an accelerator and grant application marketplace with directory filters and a pipeline CRM. Wellfound is now a startup hiring platform with no fundraising product.\n" +
    "What we did not find publicly documented anywhere else is a plain-language reason for every matching criterion, weighted by the investor's own priorities. And no one connects all four steps in one founder-investor loop: get ready, see who fits, understand why, and move straight into a private deal room.\n" +
    "We also built for Indian rounds: rupee amounts in lakh and crore, company verification by GSTIN or registration number, and funding rounds that separate committed from received capital.\n" +
    "Basis: each platform's public product, pricing and help-centre pages, reviewed in November 2026. Signed-in dashboards were not inspected. Filled = publicly documented; ring = partial (for example, filters rather than fit ranking); empty = not found in public documentation."
  );
}

// =====================================================================
// 6. BUSINESS OPPORTUNITY + VISION
// =====================================================================
pres.addSection({ title: "Where" });
{
  const s = light("Built for both sides of the funding ecosystem.", "Where");
  const lanes = [
    ["FOUNDERS", "Free", "Founder Pro", "₹4,999 / yr"],
    ["INVESTORS", "Free discovery", "Investor Pro", "₹50,000 / yr"],
    ["ECOSYSTEMS", "Incubators", "Partnerships", "per cohort"],
  ];
  const ax = M + 2.4, bx = M + 6.3, bw = 3.5, y0 = 2.2;
  lanes.forEach(([who, a, b, price], i) => {
    const y = y0 + i * 0.92;
    T(s, who, { x: M, y, w: 2.2, h: 0.62, fontSize: 13, bold: true, color: C.accent1, charSpacing: 2, valign: "middle" });
    rrect(s, { x: ax, y, w: 3.0, h: 0.62, rectRadius: 0.31, fill: { color: HEX.lt2 } });
    T(s, a, { x: ax, y, w: 3.0, h: 0.62, fontSize: 17, align: "center", valign: "middle" });
    link(s, ax + 3.1, y + 0.31, bx - 0.12, y + 0.31, { color: HEX.accent3, width: 1.5, arrow: true });
    rrect(s, { x: bx, y, w: bw, h: 0.62, rectRadius: 0.31, fill: { color: HEX.dk1 } });
    T(s, [{ text: b + "   ", options: { bold: true } }, { text: price, options: { color: SOFT } }], { x: bx, y, w: bw, h: 0.62, fontSize: 16, color: C.background1, align: "center", valign: "middle" });
  });
  // one label over the whole paid column: all of it is a proposal
  const bracketX = bx + bw + 0.3, by0 = y0 + 0.05, by1 = y0 + 2 * 0.92 + 0.57;
  link(s, bracketX, by0, bracketX, by1, { color: HEX.accent6, width: 1.25 });
  link(s, bracketX - 0.12, by0, bracketX, by0, { color: HEX.accent6, width: 1.25 });
  link(s, bracketX - 0.12, by1, bracketX, by1, { color: HEX.accent6, width: 1.25 });
  T(s, [{ text: "PROPOSED", options: { bold: true, charSpacing: 2, breakLine: true } }, { text: "pricing, not yet built", options: { fontSize: 11 } }],
    { x: bracketX + 0.2, y: (by0 + by1) / 2 - 0.3, w: W - M - bracketX - 0.2, h: 0.6, fontSize: 12, color: C.accent6, valign: "middle" });
  // vision timeline
  const ty = 5.55, tx0 = M + 0.2, tx1 = W - M - 0.2, tstep = (tx1 - tx0) / 2;
  link(s, tx0, ty, tx1, ty, { color: HEX.accent4, width: 2 });
  link(s, tx0, ty, tx0 + tstep, ty, { color: HEX.accent1, width: 3 });
  [["NOW", "Working product"], ["NEXT", "Pilots with founders and investors"], ["FUTURE", "Scale the ecosystem"]].forEach(([k, v], i) => {
    const x = tx0 + i * tstep, al = i === 0 ? "left" : i === 2 ? "right" : "center";
    circle(s, x, ty, i === 0 ? 0.32 : 0.26, { fill: { color: i === 0 ? HEX.accent1 : HEX.lt1 }, line: { color: HEX.accent1, width: 2 } });
    const bx2 = al === "left" ? x - 0.16 : al === "right" ? x - 3.84 : x - 2;
    T(s, k, { x: bx2, y: ty + 0.32, w: 4, h: 0.3, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2, align: al });
    T(s, v, { x: bx2, y: ty + 0.64, w: 4, h: 0.35, fontSize: 17, align: al });
  });
  s.addNotes(
    "Business opportunity and vision (about 40 seconds).\n" +
    "Important: no monetisation is built yet. Everything in the top half is a proposal to validate in pilots.\n" +
    "Founders: free to build a profile, run readiness checks and see matches. Founder Pro (proposed Rs 4,999 a year) adds more intro requests a day, unlimited readiness re-runs and deck analytics. Daily intro limits already exist in the product, so they're the natural free-tier lever.\n" +
    "Investors: free discovery. Investor Pro (proposed Rs 50,000 a year) adds team seats and pipeline and portfolio analytics.\n" +
    "Ecosystems: incubators and accelerators run cohorts on VentureX through paid partnerships.\n" +
    "For reference, OpenVC Premium is $299 a year and Gust Launch ranges from $450 to $3,500 a year.\n" +
    "Illustrative bottom-up check (not a forecast): 2% of the 2,07,135 recognised startups at Rs 4,999 is about Rs 2.07 Cr a year; 10% of the roughly 3,170 investors active in 2025 at Rs 50,000 is about Rs 1.59 Cr; about Rs 3.7 Cr a year in total. Adoption and price are assumptions to test.\n" +
    "Vision. Now: a working product on both sides, covered by 115 backend tests, an 89-check API flow and seven end-to-end browser test suites. VentureX is pre-launch, with no users or revenue yet. Next: deploy (a Render blueprint is ready), switch on the AI engine in production, add email delivery, and pilot with incubators, angel networks and founders. Future: semantic matching, accelerator programmes, investor analytics and integrations."
  );
}

// =====================================================================
// 7. CURIOSITY: one real glimpse of the product
// =====================================================================
pres.addSection({ title: "Demo" });
{
  const s = light("Not just a match. A reason why.", "Demo");
  T(s, "96%", { x: M, y: 1.8, w: 4.2, h: 1.45, fontSize: 96, bold: true, color: C.accent1 });
  T(s, "fit, from the investor's own priorities", { x: M, y: 3.3, w: 4.2, h: 0.35, fontSize: 16, color: C.text2 });
  const crit = [["Industry", 3], ["Stage", 3], ["Cheque size", 2], ["Geography", 2]];
  crit.forEach(([c, w], i) => {
    const y = 4.0 + i * 0.52;
    circle(s, M + 0.15, y + 0.17, 0.3, { fill: { color: HEX.accent5 } });
    T(s, "✓", { x: M, y: y + 0.02, w: 0.3, h: 0.3, fontSize: 12, bold: true, color: C.background1, align: "center", valign: "middle" });
    T(s, c, { x: M + 0.5, y, w: 1.9, h: 0.34, fontSize: 17, valign: "middle" });
    for (let k = 0; k < 3; k++) rect(s, { x: M + 2.5 + k * 0.34, y: y + 0.11, w: 0.28, h: 0.13, fill: { color: k < w ? HEX.accent1 : HEX.accent4 } });
  });
  T(s, "priority weight", { x: M + 2.5, y: 6.1, w: 1.6, h: 0.25, fontSize: 11, color: C.accent3 });
  const sx = M + 4.6, sw = W - M - sx, sh = (sw * 1110) / 2240;
  rect(s, { x: sx, y: 1.9, w: sw, h: sh, fill: { color: HEX.lt1 }, line: { color: HEX.accent4, width: 0.75 },
    shadow: { type: "outer", color: "0E1A2B", opacity: 0.14, blur: 14, offset: 4, angle: 90 } });
  s.addImage({ path: SHOT("match_reasons.png"), x: sx, y: 1.9, w: sw, h: sh, altText: "VentureX startup page showing a 96% fit and the reason for each criterion", objectName: "Screenshot: fit with reasons" });
  T(s, "Live product · demo data", { x: sx, y: 1.9 + sh + 0.12, w: sw, h: 0.25, fontSize: 11, color: C.accent3 });
  s.addNotes(
    "Curiosity (about 25 seconds). This is the moment we want the audience to remember, and the one we'll show live.\n" +
    "On the right is a real screen from VentureX with demo data: a startup that fits an investor at 96%, with a plain-language reason for every criterion (industry, stage, cheque size, geography, traction, business model).\n" +
    "The score is built from the investor's own priorities. Each criterion is scored, then weighted by how much the investor says it matters (by default industry and stage count most). Exclusions (an excluded industry or country, or unmet required traction) remove a startup entirely, and weak fits are never recommended.\n" +
    "Matching is deterministic and auditable. We use AI where judgement helps, in the founder's readiness report, not to hide how fit is calculated.\n" +
    "Transition: 'Let's show you how a founder gets here, and what the investor sees.'"
  );
}

// =====================================================================
// 8. CLOSING + TRANSITION TO THE LIVE DEMO
// =====================================================================
{
  const s = pres.addSlide({ masterName: "VX Dark", sectionTitle: "Demo" });
  T(s, "Making every startup-investor conversation count.", { x: M, y: 0.85, w: CW, h: 0.45, fontSize: 18, color: MUTED_ON_DARK });
  T(s, [
    { text: "Ready startups.", options: { breakLine: true } },
    { text: "Right investors.", options: { color: SOFT } },
  ], { x: M, y: 1.55, w: CW, h: 2.3, fontSize: 64, bold: true, color: C.background1 });
  T(s, "LIVE DEMO", { x: M, y: 4.35, w: 3, h: 0.3, fontSize: 12, bold: true, color: SOFT, charSpacing: 3 });
  const stops = [["Founder", "readiness · matches"], ["Investor", "discover · interest"], ["Deal room", "connect · share"]];
  const px0 = M + 1.2, px1 = M + 8.6, pstep = (px1 - px0) / 2, py = 5.1;
  link(s, px0, py, px1, py, { color: LINE_ON_DARK, width: 2 });
  stops.forEach(([a, b], i) => {
    const x = px0 + i * pstep;
    circle(s, x, py, 0.36, { fill: { color: i === 2 ? HEX.accent1 : HEX.dk1 }, line: { color: SOFT, width: 2 } });
    T(s, a, { x: x - 1.2, y: py + 0.32, w: 2.4, h: 0.35, fontSize: 17, bold: true, color: C.background1, align: "center" });
    T(s, b, { x: x - 1.2, y: py + 0.68, w: 2.4, h: 0.3, fontSize: 13, color: MUTED_ON_DARK, align: "center" });
  });
  T(s, "VentureX", { x: W - M - 4, y: 6.35, w: 4, h: 0.3, fontSize: 14, bold: true, color: C.background1, align: "right" });
  T(s, "Anshitha Yeruva  |  Nitya Nara", { x: M, y: 6.35, w: 6, h: 0.3, fontSize: 14, color: "7D879A" });
  s.addNotes(
    "Close and hand-off to the live demo (about 15 seconds, then switch to the website).\n" +
    "'Our goal is simple: make every startup-investor conversation count. Ready startups. Right investors. Let's show you.'\n" +
    "Suggested demo path:\n" +
    "1. Founder portal: the startup profile and materials, then the AI readiness report (scores, gaps, prioritised fixes).\n" +
    "2. Find investors: investors ranked by how well the startup meets each investor's own criteria, with the reasons. Request an intro.\n" +
    "3. Investor portal: the thesis and priorities, then Discover, which starts from the saved criteria. Open a startup to see the fit and its reasons, and express interest.\n" +
    "4. Deal room: once the founder accepts, a private room opens with chat, NDA, documents, deal stage and funding round.\n" +
    "Use demo data only."
  );
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
