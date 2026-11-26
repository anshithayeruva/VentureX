// Builds pitch-deck/VentureX_Pitch_Deck.pptx (16:9, editable shapes, text and native table).
//   cd pitch-deck/src && npm install && node build_deck.js
// Every figure in the deck is either verified in the VentureX codebase or cited in the slide's
// footnote and speaker notes. Proposed pricing and the market scenario are labelled as such.
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require("./apply_theme.js");

const ROOT = path.resolve(__dirname, "..");
const SHOT = (f) => path.join(ROOT, "assets", "screens", f);
const OUT = path.join(ROOT, "v1", "VentureX_Pitch_Deck_v1.pptx");

const THEME = {
  name: "VentureX",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "0E1A2B", // ink navy
    lt1: "FFFFFF",
    dk2: "4B5567", // secondary text
    lt2: "F3F4F6", // cool grey panel
    accent1: "2D5BD8", // blue accent
    accent2: "DCE4F8", // pale blue
    accent3: "8A93A3", // muted grey
    accent4: "E3E6EB", // hairline
    accent5: "0F7A55", // "live" green
    accent6: "9A5B13", // "proposed" amber
    hlink: "2D5BD8",
    folHlink: "4B5567",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.author = "Anshitha Yeruva, Nitya Nara";
pres.title = "VentureX: AI-powered startup readiness and investor matching";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

const W = 13.333, M = 0.6, CW = W - 2 * M;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "VX Dark",
  background: { color: HEX.dk1 },
  objects: [],
});
pres.defineSlideMaster({
  title: "VX Content",
  background: { color: HEX.lt1 },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: "eyebrow", type: "body", x: M, y: 0.42, w: CW, h: 0.3, fontSize: 11, bold: true, color: C.accent1, charSpacing: 2, margin: 0, valign: "top" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.74, w: CW, h: 1.0, fontSize: 30, bold: true, color: C.text1, margin: 0, valign: "top", align: "left", fontFace: "Arial" }, text: "" } },
    { text: { text: "VentureX", options: { x: M, y: 7.02, w: 3, h: 0.25, fontSize: 10, bold: true, color: C.accent3, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.02, w: 0.6, h: 0.25, fontSize: 10, color: C.accent3, align: "right", margin: 0 },
});

// ---------- helpers ----------
const T = (slide, text, o) => slide.addText(text, { isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: "top", ...o });
const box = (slide, o) => slide.addShape(pres.shapes.RECTANGLE, { line: { type: "none" }, ...o });
const rbox = (slide, o) => slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { rectRadius: 0.08, line: { type: "none" }, ...o });
const line = (slide, x, y, w, h, o = {}) => slide.addShape(pres.shapes.LINE, { x, y, w, h, line: { color: HEX.accent4, width: 1, ...o } });
// Lines can't have negative extents in OOXML: normalise and flip instead.
const arrow = (slide, x, y, w, h, color = HEX.accent3) => {
  const flipH = w < 0, flipV = h < 0;
  slide.addShape(pres.shapes.LINE, {
    x: flipH ? x + w : x, y: flipV ? y + h : y, w: Math.abs(w), h: Math.abs(h), flipH, flipV,
    line: { color, width: 1.5, endArrowType: "triangle" },
  });
};
const source = (slide, text) => T(slide, text, { x: M, y: 6.6, w: CW, h: 0.34, fontSize: 10, color: C.accent3, valign: "bottom" });
const content = (eyebrow, title, section) => {
  const s = pres.addSlide({ masterName: "VX Content", sectionTitle: section });
  s.addText(eyebrow, { placeholder: "eyebrow" });
  s.addText(title, { placeholder: "title" });
  return s;
};
// A screenshot in a thin frame with a soft shadow; fits (pw x ph pixels) into the w x h box, top-left aligned.
const screen = (slide, file, pw, ph, x, y, w, h, name) => {
  let iw = w, ih = (w * ph) / pw;
  if (ih > h) { ih = h; iw = (h * pw) / ph; }
  box(slide, { x, y, w: iw, h: ih, fill: { color: HEX.lt1 }, line: { color: HEX.accent4, width: 0.75 },
    shadow: { type: "outer", color: "0E1A2B", opacity: 0.12, blur: 12, offset: 3, angle: 90 } });
  slide.addImage({ path: SHOT(file), x, y, w: iw, h: ih, altText: name, objectName: name });
  return { w: iw, h: ih };
};
const pill = (slide, text, x, y, w, fill, color) => {
  rbox(slide, { x, y, w, h: 0.3, fill: { color: fill }, rectRadius: 0.15 });
  T(slide, text, { x, y, w, h: 0.3, fontSize: 10, bold: true, color, align: "center", valign: "middle" });
};

// =====================================================================
// 1. COVER
// =====================================================================
pres.addSection({ title: "Opening" });
{
  const s = pres.addSlide({ masterName: "VX Dark", sectionTitle: "Opening" });
  T(s, "VentureX", { x: M + 0.1, y: 1.55, w: 8, h: 0.5, fontSize: 18, bold: true, color: C.background1, charSpacing: 1 });
  T(s, [
    { text: "Get investor-ready.", options: { breakLine: true } },
    { text: "Meet investors who fit.", options: { color: "8FA9F0" } },
  ], { x: M + 0.1, y: 2.25, w: 11, h: 2.0, fontSize: 54, bold: true, color: C.background1 });
  T(s, "AI-powered startup readiness and investor matching platform", { x: M + 0.1, y: 4.45, w: 10, h: 0.45, fontSize: 20, color: "C9D2E3" });
  line(s, M + 0.1, 5.55, 3.2, 0, { color: "3A4A66", width: 1 });
  T(s, "Anshitha Yeruva  ·  Nitya Nara", { x: M + 0.1, y: 5.75, w: 8, h: 0.35, fontSize: 14, color: "C9D2E3" });
  s.addNotes("VentureX helps early-stage founders get investor-ready and find investors whose criteria they actually meet, and helps investors find startups that fit their thesis, with the reasons shown. Team: Anshitha Yeruva and Nitya Nara.");
}

// =====================================================================
// 2. THE BIGGER PICTURE
// =====================================================================
pres.addSection({ title: "Problem" });
{
  const s = content("THE LANDSCAPE", "India has over two lakh startups. Only a small fraction raise in any given year.", "Problem");
  const stats = [
    ["2,07,135", "startups recognised by DPIIT", "as of 31 Dec 2025"],
    ["1,518", "tech funding rounds in 2025", "down 39% from 2024"],
    ["~3,170", "investors took part in 2025 rounds", "down 53% from ~6,800"],
  ];
  const colW = CW / 3;
  stats.forEach(([n, l1, l2], i) => {
    const x = M + i * colW;
    T(s, n, { x, y: 2.15, w: colW - 0.3, h: 1.0, fontSize: 54, bold: true, color: i === 0 ? C.text1 : C.accent1 });
    T(s, l1, { x, y: 3.2, w: colW - 0.4, h: 0.35, fontSize: 16, bold: true });
    T(s, l2, { x, y: 3.55, w: colW - 0.4, h: 0.3, fontSize: 14, color: C.text2 });
  });
  // scale bar: recognised startups vs funding rounds
  const by = 4.55, bw = CW;
  T(s, "For scale: recognised startups vs. funding rounds in a year", { x: M, y: by - 0.42, w: CW, h: 0.3, fontSize: 12, bold: true, color: C.text2 });
  box(s, { x: M, y: by, w: bw, h: 0.42, fill: { color: HEX.accent4 } });
  box(s, { x: M, y: by, w: Math.max(0.06, bw * (1518 / 207135)), h: 0.42, fill: { color: HEX.accent1 } });
  T(s, "2,07,135 recognised startups", { x: M + 0.25, y: by, w: 5, h: 0.42, fontSize: 12, color: C.text2, valign: "middle" });
  T(s, "1,518 rounds  ≈ 0.7%", { x: M, y: by + 0.5, w: 4, h: 0.3, fontSize: 12, bold: true, color: C.accent1 });
  T(s, "Different datasets (all DPIIT-recognised startups vs. tech rounds tracked by Tracxn), shown together only for scale. With fewer investors writing cheques, both sides need to find the right match faster.",
    { x: M, y: by + 0.95, w: CW, h: 0.6, fontSize: 14, color: C.text2 });
  source(s, "Sources: Ministry of Commerce & Industry release, reported by The Tribune (Feb 2026); Tracxn India Tech annual data, reported by TechCrunch (27 Dec 2025).");
  s.addNotes("2,07,135 DPIIT-recognised startups as of 31 Dec 2025 (Ministry of Commerce & Industry, written reply in the Rajya Sabha, reported by The Tribune). Tracxn 2025: 1,518 funding rounds (down ~39%), about 3,170 participating investors (down 53% from about 6,800), seed funding $1.1B (down 30%), reported by TechCrunch on 27 Dec 2025. The two datasets differ in scope; the bar is only for scale.");
}

// =====================================================================
// 3. THE PROBLEM
// =====================================================================
{
  const s = content("THE PROBLEM", "Founders and investors spend weeks searching, and still miss each other", "Problem");
  const y = 2.05, h = 3.95, gap = 0.35, pw = (CW - gap) / 2;
  // founders panel (light)
  rbox(s, { x: M, y, w: pw, h, fill: { color: HEX.lt2 } });
  T(s, "FOUNDERS", { x: M + 0.4, y: y + 0.35, w: 4, h: 0.3, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2 });
  T(s, "“Who should I even pitch, and am I ready?”", { x: M + 0.4, y: y + 0.7, w: pw - 0.8, h: 0.45, fontSize: 18, bold: true });
  const f = [
    ["Investor research is manual", "Lists, LinkedIn and cold email, one by one"],
    ["Fit is guesswork", "Stage, sector and cheque size are rarely clear up front"],
    ["No honest feedback", "Rejections rarely say what was missing"],
    ["Readiness is unclear", "Is the deck, market sizing or traction good enough?"],
  ];
  f.forEach(([a, b], i) => {
    const yy = y + 1.55 + i * 0.58;
    T(s, a, { x: M + 0.4, y: yy, w: pw - 0.8, h: 0.28, fontSize: 15, bold: true });
    T(s, b, { x: M + 0.4, y: yy + 0.27, w: pw - 0.8, h: 0.28, fontSize: 14, color: C.text2 });
  });
  // investors panel (dark)
  const x2 = M + pw + gap;
  rbox(s, { x: x2, y, w: pw, h, fill: { color: HEX.dk1 } });
  T(s, "INVESTORS", { x: x2 + 0.4, y: y + 0.35, w: 4, h: 0.3, fontSize: 12, bold: true, color: "8FA9F0", charSpacing: 2 });
  T(s, "“Which of these pitches actually fit our thesis?”", { x: x2 + 0.4, y: y + 0.7, w: pw - 0.8, h: 0.45, fontSize: 18, bold: true, color: C.background1 });
  const v = [
    ["Too many pitches to read", "Most inbound decks fall outside the thesis"],
    ["Information isn't standardised", "Every startup describes itself differently"],
    ["Sourcing takes partner time", "Screening happens before any real conversation"],
    ["Signals are hard to trust", "Is the company real? Is the investor active?"],
  ];
  v.forEach(([a, b], i) => {
    const yy = y + 1.55 + i * 0.58;
    T(s, a, { x: x2 + 0.4, y: yy, w: pw - 0.8, h: 0.28, fontSize: 15, bold: true, color: C.background1 });
    T(s, b, { x: x2 + 0.4, y: yy + 0.27, w: pw - 0.8, h: 0.28, fontSize: 14, color: "C9D2E3" });
  });
  T(s, "The cost: promising startups go unseen, and investors spend time on deals that were never a fit.", { x: M, y: 6.25, w: CW, h: 0.35, fontSize: 16, bold: true, color: C.text1 });
  s.addNotes("Two-sided problem. Founders: manual investor research, unclear fit, little actionable feedback, uncertain readiness. Investors: high inbound volume, unstructured information, time-consuming sourcing and screening, trust signals. These are qualitative problem statements, not survey results.");
}

// =====================================================================
// 4. WHY EXISTING SOLUTIONS LEAVE AN OPPORTUNITY
// =====================================================================
pres.addSection({ title: "Solution" });
{
  const s = content("THE LANDSCAPE", "Today's platforms each solve one step of the journey", "Solution");
  const hdr = ["", "What it is", "Readiness feedback", "Ranks investors by fit", "Shows why it fits", "Private deal room"];
  const H = (t) => ({ text: t, options: { bold: true, color: HEX.dk2, fontSize: 11, fill: { color: HEX.lt1 }, valign: "bottom" } });
  const cell = (t, o = {}) => ({ text: t, options: { fontSize: 12, color: HEX.dk1, valign: "middle", ...o } });
  const yes = (t) => cell(t, { color: HEX.accent5, bold: true });
  const part = (t) => cell(t, { color: HEX.dk2 });
  const no = (t) => cell(t, { color: HEX.accent3 });
  const name = (t) => cell(t, { bold: true, fontSize: 14 });
  const rows = [
    hdr.map(H),
    [name("OpenVC"), cell("Investor database, outreach and CRM"), yes("Yes: deck score, fundability test"), yes("Yes: search ranked by fit"), no("Not documented"), no("No: points to DocSend, Drive")],
    [name("Gust"), cell("Company profiles and investor-group software"), part("Partial: benchmark tool"), part("Filters: location, industry, keyword"), no("Not documented"), yes("Yes: for investor groups")],
    [name("F6S"), cell("Accelerator, grant and programme applications"), no("Not documented"), part("Directory filters"), no("Not documented"), no("No: pipeline CRM instead")],
    [name("Wellfound"), cell("Startup hiring (formerly AngelList Talent)"), no("No fundraising product"), no("—"), no("—"), no("—")],
  ];
  const vx = [cell("VentureX", { bold: true, fontSize: 14, color: HEX.lt1 }), cell("Readiness, matching and deal rooms in one loop", { color: HEX.lt1 }),
    cell("Yes: 5-area private report", { color: HEX.lt1, bold: true }), cell("Yes, both directions", { color: HEX.lt1, bold: true }),
    cell("Yes: reason per criterion", { color: HEX.lt1, bold: true }), cell("Yes: NDA, files, audit log", { color: HEX.lt1, bold: true })];
  vx.forEach((c) => (c.options.fill = { color: HEX.dk1 }));
  rows.push(vx);
  s.addTable(rows, {
    x: M, y: 1.95, w: CW, colW: [1.45, 2.85, 2.0, 2.0, 1.85, 1.98],
    rowH: [0.42, 0.62, 0.62, 0.62, 0.62, 0.66],
    border: { type: "solid", color: HEX.accent4, pt: 0.75 }, margin: [0.06, 0.1, 0.06, 0.1], fontFace: "Arial",
  });
  T(s, "Our opening: connect readiness feedback, explainable fit and the deal room into one founder–investor loop, built for Indian early-stage rounds.", { x: M, y: 5.85, w: CW, h: 0.6, fontSize: 16, bold: true });
  source(s, "From public product, pricing and help-centre pages (Nov 2026); signed-in dashboards not inspected. \"Not documented\": no public description found.");
  s.addNotes("OpenVC: free-first investor database with outreach, CRM, AI deck score (0-5) and a 30-question Fundability test; investor search ranked by fit; no data room (their docs point to DocSend/Drive). Pricing Free / Premium $299/yr / Ultra $899/yr. Gust: free company profile; paid Gust Launch $450-$3,500/yr for incorporation and cap table; Group Investor Platform for angel groups with pipelines and data rooms; founders find groups via location/industry/keyword filters. F6S: community for applying to accelerators, grants and funds, plus the Pipeline CRM for organisations. Wellfound: startup hiring, no investor product. We don't claim to be first at AI or matching; OpenVC also scores decks and ranks by fit.");
}

// =====================================================================
// 5. INTRODUCING VENTUREX
// =====================================================================
{
  const s = content("INTRODUCING VENTUREX", "Founders get investor-ready. Investors see startups that fit their thesis, with the reasons.", "Solution");
  const y0 = 2.35;
  // founders column
  const colW = 3.2;
  T(s, "FOUNDERS BRING", { x: M, y: y0, w: colW, h: 0.3, fontSize: 11, bold: true, color: C.accent1, charSpacing: 2 });
  ["Startup profile and raise", "Pitch deck and documents", "GitHub repo and demo link"].forEach((t, i) => {
    rbox(s, { x: M, y: y0 + 0.45 + i * 0.72, w: colW, h: 0.56, fill: { color: HEX.lt2 } });
    T(s, t, { x: M + 0.2, y: y0 + 0.45 + i * 0.72, w: colW - 0.4, h: 0.56, fontSize: 14, valign: "middle" });
  });
  // investors column
  const xr = W - M - colW;
  T(s, "INVESTORS BRING", { x: xr, y: y0, w: colW, h: 0.3, fontSize: 11, bold: true, color: C.accent1, charSpacing: 2, align: "right" });
  ["Sectors, stages, geography", "Cheque size and traction bar", "Priority for each criterion"].forEach((t, i) => {
    rbox(s, { x: xr, y: y0 + 0.45 + i * 0.72, w: colW, h: 0.56, fill: { color: HEX.lt2 } });
    T(s, t, { x: xr + 0.2, y: y0 + 0.45 + i * 0.72, w: colW - 0.4, h: 0.56, fontSize: 14, valign: "middle", align: "right" });
  });
  // core
  const cx = M + colW + 0.75, cw = W - 2 * (M + colW + 0.75);
  rbox(s, { x: cx, y: y0 - 0.05, w: cw, h: 2.75, fill: { color: HEX.dk1 } });
  T(s, "VentureX", { x: cx + 0.35, y: y0 + 0.2, w: cw - 0.7, h: 0.4, fontSize: 20, bold: true, color: C.background1 });
  [["Readiness report", "scores five areas, lists gaps and fixes"], ["Fit engine", "scores each startup against each thesis"], ["Deal rooms", "private chat, NDA, documents, rounds"]].forEach(([a, b], i) => {
    const yy = y0 + 0.8 + i * 0.6;
    T(s, a, { x: cx + 0.35, y: yy, w: 1.95, h: 0.4, fontSize: 14, bold: true, color: "8FA9F0", valign: "middle" });
    T(s, b, { x: cx + 2.3, y: yy, w: cw - 2.6, h: 0.4, fontSize: 13, color: "E3E8F2", valign: "middle" });
  });
  // arrows in
  [0, 1, 2].forEach((i) => {
    const yy = y0 + 0.73 + i * 0.72;
    arrow(s, M + colW + 0.1, yy, 0.55, 0);
    arrow(s, xr - 0.1, yy, -0.55, 0);
  });
  // outputs
  const oy = y0 + 3.05;
  arrow(s, cx + 0.8, y0 + 2.75, -0.01, 0.42, HEX.accent1);
  arrow(s, cx + cw - 0.8, y0 + 2.75, 0.01, 0.42, HEX.accent1);
  rbox(s, { x: M, y: oy + 0.2, w: CW / 2 - 0.15, h: 0.85, fill: { color: HEX.accent2 } });
  T(s, [{ text: "Founders get ", options: {} }, { text: "investors ranked by fit, and what to fix first", options: { bold: true } }],
    { x: M + 0.3, y: oy + 0.2, w: CW / 2 - 0.75, h: 0.85, fontSize: 15, valign: "middle" });
  rbox(s, { x: M + CW / 2 + 0.15, y: oy + 0.2, w: CW / 2 - 0.15, h: 0.85, fill: { color: HEX.accent2 } });
  T(s, [{ text: "Investors get ", options: {} }, { text: "startups ranked by fit, with the reason for each criterion", options: { bold: true } }],
    { x: M + CW / 2 + 0.45, y: oy + 0.2, w: CW / 2 - 0.75, h: 0.85, fontSize: 15, valign: "middle" });
  s.addNotes("Two-sided ecosystem. Founders provide profile, materials and code links; investors provide a structured thesis with priorities. VentureX turns this into a private readiness report for founders, fit scores with reasons for both sides, and a private deal room once a founder accepts an intro.");
}

// =====================================================================
// 6. HOW IT WORKS
// =====================================================================
{
  const s = content("HOW IT WORKS", "Two journeys that meet in a private deal room", "Solution");
  const lanes = [
    { who: "FOUNDER", y: 2.25, steps: ["Sign up", "Build startup profile, upload deck", "Get readiness report", "Find investors ranked by fit", "Request an intro"] },
    { who: "INVESTOR", y: 4.2, steps: ["Sign up, get verified", "Set criteria and priorities", "Discover startups by fit", "Review reasons and materials", "Express interest"] },
  ];
  const lx = M + 1.45, lw = 7.0, n = 5, step = lw / (n - 1);
  lanes.forEach((L) => {
    T(s, L.who, { x: M, y: L.y + 0.08, w: 1.2, h: 0.3, fontSize: 11, bold: true, color: C.accent1, charSpacing: 2 });
    line(s, lx, L.y + 0.22, lw, 0, { color: HEX.accent4, width: 2 });
    L.steps.forEach((t, i) => {
      const x = lx + i * step;
      s.addShape(pres.shapes.OVAL, { x: x - 0.22, y: L.y, w: 0.44, h: 0.44, fill: { color: i === n - 1 ? HEX.accent1 : HEX.lt1 }, line: { color: HEX.accent1, width: 1.5 } });
      T(s, String(i + 1), { x: x - 0.22, y: L.y, w: 0.44, h: 0.44, fontSize: 13, bold: true, align: "center", valign: "middle", color: i === n - 1 ? C.background1 : C.accent1 });
      T(s, t, { x: x - 0.82, y: L.y + 0.58, w: 1.64, h: 0.7, fontSize: 13, align: "center" });
    });
  });
  // shared deal room
  const dx = lx + lw + 1.15, dw = W - M - dx;
  arrow(s, lx + lw + 0.3, 2.47, dx - (lx + lw + 0.3) - 0.08, 0, HEX.accent1);
  arrow(s, lx + lw + 0.3, 4.42, dx - (lx + lw + 0.3) - 0.08, 0, HEX.accent1);
  rbox(s, { x: dx, y: 2.0, w: dw, h: 2.85, fill: { color: HEX.dk1 } });
  T(s, "Deal room", { x: dx + 0.3, y: 2.25, w: dw - 0.6, h: 0.4, fontSize: 18, bold: true, color: C.background1 });
  T(s, "Opens when the founder accepts. Chat, NDA, shared documents, deal stage, funding round and audit log.",
    { x: dx + 0.3, y: 2.8, w: dw - 0.6, h: 1.9, fontSize: 14, color: "C9D2E3" });
  T(s, "Intros run both ways: founders request intros from investors, and investors express interest in startups. The other side always decides. Requests with no reply expire after 14 days.",
    { x: M, y: 5.75, w: CW, h: 0.6, fontSize: 14, color: C.text2 });
  s.addNotes("Founder: register, create startup profile and upload materials, private readiness report, Find investors ranked by fit to the investor's own criteria, request an intro (Interested / Pass, 14-day expiry). Investor: register and get verified, set a 10-area thesis with priorities, Discover with fit scores and reasons, review the startup, express interest. Either way, the founder decides; acceptance opens a deal room with chat, NDA, documents, stage tracking, funding round and an audit log.");
}

// =====================================================================
// 7. AI READINESS
// =====================================================================
pres.addSection({ title: "Product" });
{
  const s = content("AI READINESS REPORT", "Founders see what investors will question, before they publish", "Product");
  const lw = 4.6;
  T(s, "Scores five areas, out of 100", { x: M, y: 2.0, w: lw, h: 0.3, fontSize: 12, bold: true, color: C.accent1 });
  const dims = [
    ["Problem / solution fit", "Is the pain evidenced, and does the product solve it?"],
    ["Market sizing & competition", "Sourced TAM/SAM/SOM, target customer, positioning"],
    ["Business model clarity", "Pricing, revenue model, unit economics, go-to-market"],
    ["Traction & validation", "Users, pilots, LOIs, revenue, growth"],
    ["Product & technology", "Demo, codebase quality, technical moat"],
  ];
  dims.forEach(([a, b], i) => {
    const y = 2.4 + i * 0.6;
    T(s, a, { x: M, y, w: lw, h: 0.28, fontSize: 14, bold: true });
    T(s, b, { x: M, y: y + 0.26, w: lw, h: 0.28, fontSize: 12, color: C.text2 });
  });
  T(s, "Founders also get", { x: M, y: 5.45, w: lw, h: 0.3, fontSize: 12, bold: true, color: C.accent1 });
  [["Strengths", "Gaps by severity"], ["Prioritised fixes", "Industry insights"]].forEach((row, r) => {
    let cx = M;
    row.forEach((c) => { const w = 0.35 + c.length * 0.09; pill(s, c, cx, 5.8 + r * 0.4, w, HEX.accent2, HEX.dk1); cx += w + 0.12; });
  });
  T(s, "Private: investors never see the score.", { x: M, y: 6.65, w: lw, h: 0.3, fontSize: 12, color: C.text2 });
  const sx = M + lw + 0.45, sw = W - M - sx;
  const d = screen(s, "readiness.png", 2190, 1545, sx, 1.95, sw, 4.2, "Screenshot: readiness report");
  T(s, "Live product, demo startup. This setup shows the rule-based fallback; with an API key, Claude or Gemini reads the deck, documents and GitHub repo and fills the same report.",
    { x: sx, y: 1.95 + d.h + 0.12, w: d.w, h: 0.45, fontSize: 10, color: C.accent3 });
  s.addNotes("Verified in backend/app/services/analysis_service.py: five dimensions (problem_solution_fit, market_sizing, business_model_clarity, traction_feasibility, product_technology), overall score, strengths, gaps with severity, prioritised suggestions and industry insights. Engines: Claude (Anthropic) or Gemini when an API key is configured, otherwise a transparent rule-based checker that is labelled as such in the UI. Every run is stored, so founders see their history. The screenshot was taken in rule-based mode with a demo startup.");
}

// =====================================================================
// 8. MATCHING
// =====================================================================
{
  const s = content("EXPLAINABLE MATCHING", "Every fit score comes with its reasons", "Product");
  const lw = 5.1;
  T(s, "Each criterion is scored 0–100, then weighted by the investor's own priorities", { x: M, y: 2.0, w: lw, h: 0.55, fontSize: 14, bold: true });
  const crit = [["Industry", "High", 3], ["Stage", "High", 3], ["Check size", "Medium", 2], ["Geography", "Medium", 2], ["Traction", "Medium", 2], ["Team and IP", "Medium", 2], ["Business model", "Low", 1]];
  crit.forEach(([c, p, w], i) => {
    const y = 2.7 + i * 0.37;
    T(s, c, { x: M, y, w: 1.7, h: 0.3, fontSize: 13, valign: "middle" });
    for (let k = 0; k < 3; k++) box(s, { x: M + 1.75 + k * 0.42, y: y + 0.07, w: 0.36, h: 0.16, fill: { color: k < w ? HEX.accent1 : HEX.accent4 } });
    T(s, `${p} (×${w})`, { x: M + 3.1, y, w: 1.5, h: 0.3, fontSize: 12, color: C.text2, valign: "middle" });
  });
  T(s, "Default priorities shown. Investors can change any of them or ignore a criterion.", { x: M, y: 5.32, w: lw, h: 0.3, fontSize: 10, color: C.accent3 });
  rbox(s, { x: M, y: 5.62, w: lw, h: 1.08, fill: { color: HEX.lt2 } });
  T(s, [
    { text: "Rules, not a black box. ", options: { bold: true } },
    { text: "Excluded industries or countries and unmet required traction remove a startup. Partial credit counts (one stage away scores 78 of 100). Below 45% isn't recommended." },
  ], { x: M + 0.2, y: 5.66, w: lw - 0.4, h: 1.0, fontSize: 12, valign: "middle" });
  const sx = M + lw + 0.45, sw = W - M - sx;
  const d = screen(s, "match_reasons.png", 2240, 1110, sx, 2.0, sw, 4.0, "Screenshot: fit score with reasons");
  T(s, "Live product, demo data: a 96% fit, with the reason for each criterion.", { x: sx, y: 2.0 + d.h + 0.1, w: sw, h: 0.3, fontSize: 10, color: C.accent3 });
  T(s, "Fit = Σ (criterion score × priority weight) ÷ Σ weights", { x: sx, y: 2.0 + d.h + 0.55, w: sw, h: 0.35, fontSize: 14, bold: true, color: C.accent1 });
  s.addNotes("Verified in backend/app/services/match_service.py: criteria scored 0-100 (industry, stage, check size, business model; geography, traction and team only when the investor set them). Priority weights High 3, Medium 2, Low 1, Ignore 0; defaults industry and stage High, check size, geography, traction and team Medium, business model Low. Score = weighted average, clamped to 40-98.8; below 45 is not recommended. Hard exclusions: excluded industry or country, unmet required traction or team requirement. Each criterion returns a plain-language reason. Matching is deterministic, so investors and founders can see exactly why a startup fits. The founder's Find investors page uses the same scores against each investor's own criteria.");
}

// =====================================================================
// 9. PRODUCT EXPERIENCE
// =====================================================================
{
  const s = content("THE PRODUCT", "A working product on both sides of the table", "Product");
  const y = 2.0, gap = 0.35;
  const lw = (CW - 0.45) / 2;
  T(s, "FOUNDER  ·  Find investors ranked by fit", { x: M, y, w: lw, h: 0.28, fontSize: 11, bold: true, color: C.accent1, charSpacing: 1 });
  screen(s, "founder_find_investors.png", 2880, 1800, M, y + 0.35, lw, 4.1, "Screenshot: founder Find investors");
  const rx = M + lw + 0.45, rw = lw;
  T(s, "INVESTOR  ·  Discover with saved criteria", { x: rx, y, w: rw, h: 0.28, fontSize: 11, bold: true, color: C.accent1, charSpacing: 1 });
  const d2 = screen(s, "investor_discover.png", 2880, 1110, rx, y + 0.35, rw, 2.4, "Screenshot: investor Discover");
  const notes = [
    ["Starts from the investor's saved criteria", "filters can be changed without overwriting them"],
    ["Fit score and the criteria each startup meets", "computed from the investor's own priorities"],
    ["Save, view details or express interest", "the founder decides whether to open a deal room"],
  ];
  notes.forEach(([a, b], i) => {
    const yy = y + 0.35 + d2.h + 0.3 + i * 0.5;
    s.addShape(pres.shapes.OVAL, { x: rx, y: yy + 0.06, w: 0.13, h: 0.13, fill: { color: HEX.accent1 }, line: { type: "none" } });
    T(s, [{ text: a, options: { bold: true, breakLine: true } }, { text: b, options: { color: HEX.dk2, fontSize: 12 } }],
      { x: rx + 0.28, y: yy, w: rw - 0.28, h: 0.48, fontSize: 13 });
  });
  source(s, "Screens captured from the running VentureX app (Nov 2026) with a demo startup and demo investor profiles.");
  s.addNotes("All screens are real captures from the running application with demo data: the founder's Find investors page (investors ranked by how well the startup meets their criteria), the investor Discover page (defaults to the investor's saved criteria, with fit and the criteria met), with notes on what investors can do from it.");
}

// =====================================================================
// 10. VALUE PROPOSITION
// =====================================================================
pres.addSection({ title: "Business" });
{
  const s = content("THE VALUE", "Less time searching. More time in the right conversations.", "Business");
  const y = 2.05, gap = 0.5, cw = (CW - gap) / 2;
  const cols = [
    ["FOR FOUNDERS", [["Know where you stand", "A private readiness score with the gaps investors will raise"], ["Target the right investors", "Ranked by how well you meet each investor's own criteria"], ["Skip the spreadsheet", "Search, request intros and track replies in one place"], ["Get seen by the right funds", "Published startups appear to investors whose thesis fits"]]],
    ["FOR INVESTORS", [["Screen faster", "Startups arrive ranked against your thesis and priorities"], ["See why it fits", "A plain-language reason for every criterion"], ["Compare like for like", "Every startup answers the same structured profile"], ["Move to a deal room", "Chat, NDA, documents and round tracking in one place"]]],
  ];
  cols.forEach(([h, items], ci) => {
    const x = M + ci * (cw + gap);
    T(s, h, { x, y, w: cw, h: 0.3, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2 });
    items.forEach(([a, b], i) => {
      const yy = y + 0.5 + i * 0.92;
      line(s, x, yy, cw, 0);
      T(s, a, { x, y: yy + 0.15, w: cw, h: 0.32, fontSize: 18, bold: true });
      T(s, b, { x, y: yy + 0.5, w: cw, h: 0.3, fontSize: 14, color: C.text2 });
    });
  });
  T(s, "VentureX improves the odds of a relevant conversation. It doesn't promise funding.", { x: M, y: 6.4, w: CW, h: 0.3, fontSize: 13, color: C.text2 });
  s.addNotes("Value for each side, stated as outcomes the product supports today. We avoid promising funding or investment outcomes.");
}

// =====================================================================
// 11. ARCHITECTURE
// =====================================================================
{
  const s = content("TECHNOLOGY", "A modern, modular stack, tested end to end", "Business");
  const y = 2.05;
  const node = (x, yy, w, h, title, sub, dark) => {
    rbox(s, { x, y: yy, w, h, fill: { color: dark ? HEX.dk1 : HEX.lt2 }, line: dark ? { type: "none" } : { color: HEX.accent4, width: 0.75 } });
    T(s, title, { x: x + 0.2, y: yy + 0.15, w: w - 0.4, h: 0.32, fontSize: 14, bold: true, color: dark ? C.background1 : C.text1 });
    T(s, sub, { x: x + 0.2, y: yy + 0.48, w: w - 0.4, h: h - 0.55, fontSize: 12, color: dark ? "C9D2E3" : C.text2 });
  };
  // main chain
  const g = 0.62, bw = (CW - 3 * g) / 4, bh = 1.15;
  const xs = [M, M + bw + g, M + 2 * (bw + g), M + 3 * (bw + g)];
  node(xs[0], y, bw, bh, "Founders & investors", "Browser, desktop and phone layouts");
  node(xs[1], y, bw, bh, "Web app", "Next.js 16, React 19, Tailwind CSS 4");
  node(xs[2], y, bw, bh, "API", "Python, FastAPI, Pydantic; business rules and fit scoring", true);
  node(xs[3], y, bw, bh, "Database", "Neon Postgres, 29 tables; money stored as exact decimals");
  [0, 1, 2].forEach((i) => arrow(s, xs[i] + bw + 0.08, y + bh / 2, g - 0.16, 0));
  // services below the API
  const sy = y + bh + 0.75;
  const sw = bw;
  const svc = [
    ["Neon Auth", "Sign-in and sessions; API checks signed tokens"],
    ["Readiness engine", "Claude or Gemini; rule-based fallback"],
    ["Fit engine", "Deterministic, weighted, explainable"],
    ["Integrations", "GitHub repo intake; email (SMTP-ready)"],
  ];
  svc.forEach(([a, b], i) => node(xs[i], sy, sw, 1.15, a, b));
  line(s, xs[0] + sw / 2, sy - 0.3, xs[3] - xs[0], 0, { color: HEX.accent3, width: 1 });
  svc.forEach((_, i) => arrow(s, xs[i] + sw / 2, sy - 0.3, 0, 0.25));
  line(s, xs[2] + bw / 2, y + bh, 0, 0.45, { color: HEX.accent3, width: 1 });
  // proof strip
  const py = sy + 1.5;
  rbox(s, { x: M, y: py, w: CW, h: 0.95, fill: { color: HEX.accent2 } });
  const proof = [["115", "automated backend tests"], ["7", "end-to-end browser suites"], ["89", "checks in the full API flow"], ["Docker", "deploy blueprint for Render"]];
  proof.forEach(([n, l], i) => {
    const x = M + 0.35 + i * (CW / 4);
    T(s, n, { x, y: py + 0.12, w: CW / 4 - 0.4, h: 0.45, fontSize: 22, bold: true, color: C.accent1 });
    T(s, l, { x, y: py + 0.55, w: CW / 4 - 0.4, h: 0.3, fontSize: 12, color: C.text1 });
  });
  s.addNotes("Verified from source and config: frontend Next.js 16.3, React 19.2, Tailwind CSS 4 (frontend/package.json); backend FastAPI, Pydantic v2, psycopg 3 (backend/requirements.txt); Neon Postgres with 29 tables (backend/app/database/schema.sql); Neon Auth (Better Auth) for sign-in, the API verifies signed JWTs; readiness via the Anthropic and Google GenAI SDKs with a rule-based fallback; GitHub API for repository intake; emails are written to a log until SMTP is configured; private file storage for decks and deal-room files; render.yaml deploys both services with Docker. Test counts are from the latest full runs.");
}

// =====================================================================
// 12. BUSINESS MODEL & MARKET
// =====================================================================
{
  const s = content("BUSINESS MODEL", "Freemium for founders, subscriptions for investors, sized from the bottom up", "Business");
  const lw = 6.1;
  T(s, "Revenue streams", { x: M, y: 2.0, w: lw, h: 0.3, fontSize: 12, bold: true, color: C.accent1 });
  const streams = [
    ["Founder Pro", "More intro requests, unlimited readiness re-runs, deck analytics", "₹4,999 / yr"],
    ["Readiness deep-dive", "One-off expanded report before a raise", "per report"],
    ["Investor Pro", "Team seats, pipeline and portfolio analytics", "₹50,000 / yr"],
    ["Ecosystem licences", "Incubators and accelerators run cohorts on VentureX", "per cohort"],
  ];
  streams.forEach(([a, b, p], i) => {
    const y = 2.4 + i * 0.78;
    line(s, M, y, lw, 0);
    T(s, a, { x: M, y: y + 0.12, w: 2.2, h: 0.3, fontSize: 14, bold: true });
    T(s, p, { x: M + lw - 1.6, y: y + 0.12, w: 1.6, h: 0.3, fontSize: 13, bold: true, color: C.accent6, align: "right" });
    T(s, b, { x: M, y: y + 0.42, w: lw, h: 0.3, fontSize: 12, color: C.text2 });
  });
  pill(s, "ALL PROPOSED: NOT BUILT", M, 5.6, 2.45, "F6EBDD", HEX.accent6);
  T(s, "For reference: OpenVC Premium $299/yr; Gust Launch $450–3,500/yr. Daily intro limits already exist in the product and are the natural free-tier lever.",
    { x: M, y: 6.0, w: lw, h: 0.5, fontSize: 11, color: C.text2 });
  // sizing
  const rx = M + lw + 0.6, rw = W - M - rx;
  rbox(s, { x: rx, y: 2.0, w: rw, h: 4.5, fill: { color: HEX.lt2 } });
  T(s, "Illustrative scenario, not a forecast", { x: rx + 0.35, y: 2.2, w: rw - 0.7, h: 0.3, fontSize: 12, bold: true, color: C.accent1 });
  const row = (y, a, b, c) => {
    T(s, a, { x: rx + 0.35, y, w: rw - 0.7, h: 0.3, fontSize: 13, color: C.text2 });
    T(s, b, { x: rx + 0.35, y: y + 0.3, w: rw - 2.0, h: 0.35, fontSize: 15, bold: true });
    T(s, c, { x: rx + rw - 1.75, y: y + 0.28, w: 1.4, h: 0.4, fontSize: 20, bold: true, align: "right" });
  };
  row(2.7, "Founders: 2,07,135 recognised startups", "× 2% paying × ₹4,999", "₹2.07 Cr");
  row(3.6, "Investors: ~3,170 active in 2025", "× 10% paying × ₹50,000", "₹1.59 Cr");
  line(s, rx + 0.35, 4.55, rw - 0.7, 0, { color: HEX.accent3 });
  T(s, "Annual revenue at these rates", { x: rx + 0.35, y: 4.7, w: rw - 2.0, h: 0.35, fontSize: 15, bold: true });
  T(s, "≈ ₹3.7 Cr", { x: rx + rw - 1.95, y: 4.62, w: 1.6, h: 0.5, fontSize: 24, bold: true, color: C.accent1, align: "right" });
  T(s, "Adoption rates and prices are assumptions to test in pilots. Ecosystem licences are upside and not counted.",
    { x: rx + 0.35, y: 5.45, w: rw - 0.7, h: 0.6, fontSize: 11, color: C.text2 });
  source(s, "Inputs: DPIIT count (Ministry of Commerce & Industry, 31 Dec 2025); active investors (Tracxn 2025, via TechCrunch). Competitor prices from openvc.app/pricing and gust.com/pricing.");
  s.addNotes("No monetisation is implemented today; every stream and price here is a proposal. Bottom-up sizing: 2,07,135 DPIIT-recognised startups x 2% paying x Rs 4,999/yr = about Rs 2.07 Cr; about 3,170 investors active in 2025 rounds (Tracxn) x 10% paying x Rs 50,000/yr = about Rs 1.59 Cr; total about Rs 3.7 Cr a year at those assumptions. Not a forecast; adoption and price are to be validated with pilots. Reference prices: OpenVC Premium $299/yr and Ultra $899/yr; Gust Launch $450, $1,250 and $3,500/yr.");
}

// =====================================================================
// 13. COMPETITIVE ADVANTAGE
// =====================================================================
{
  const s = content("WHY VENTUREX", "Our edge is the connected loop, not any single feature", "Business");
  const hdrY = 2.0;
  const c1 = M, c1w = 3.6, c2 = M + 3.85, c2w = 4.6, c3 = M + 8.75, c3w = CW - 8.75;
  T(s, "OUR EDGE", { x: c1, y: hdrY, w: c1w, h: 0.3, fontSize: 11, bold: true, color: C.accent1, charSpacing: 2 });
  T(s, "WHY IT MATTERS", { x: c2, y: hdrY, w: c2w, h: 0.3, fontSize: 11, bold: true, color: C.accent1, charSpacing: 2 });
  T(s, "WHAT OTHERS ALSO DO", { x: c3, y: hdrY, w: c3w, h: 0.3, fontSize: 11, bold: true, color: C.accent3, charSpacing: 2 });
  const rows = [
    ["Readiness linked to fit", "Founders fix the gaps that matter, then see which investors they now fit", "OpenVC scores decks; Gust offers a benchmark"],
    ["Fit you can explain", "A reason for every criterion, weighted by the investor's own priorities", "Others rank or filter; reasons aren't documented"],
    ["Founder stays in control", "Readiness stays private, drafts are never matched, intros need the founder's yes", "Gust limits what public profiles show"],
    ["Built for Indian rounds", "Rupee amounts in lakh and crore, GSTIN and registration-number checks, committed vs received capital", "Most global tools default to US dollars"],
  ];
  rows.forEach(([a, b, c], i) => {
    const y = hdrY + 0.45 + i * 0.98;
    line(s, M, y, CW, 0);
    T(s, a, { x: c1, y: y + 0.18, w: c1w, h: 0.7, fontSize: 17, bold: true });
    T(s, b, { x: c2, y: y + 0.18, w: c2w, h: 0.75, fontSize: 14 });
    T(s, c, { x: c3, y: y + 0.18, w: c3w, h: 0.75, fontSize: 13, color: C.text2 });
  });
  s.addNotes("Differentiation is the combination, not exclusivity. Readiness feedback exists elsewhere (OpenVC deck score and Fundability test; Gust benchmark), and OpenVC also ranks investors by fit. What we found no public description of elsewhere is per-criterion fit reasons weighted by the investor's own priorities, connected to a private readiness report and a deal room, with rupee-native rounds and Indian company verification (GSTIN or registration number).");
}

// =====================================================================
// 14. ROADMAP
// =====================================================================
pres.addSection({ title: "Close" });
{
  const s = content("ROADMAP", "A working product today. Pilots next.", "Close");
  const y = 2.0, gap = 0.3, cw = (CW - 2 * gap) / 3;
  const cols = [
    ["LIVE TODAY", HEX.accent5, "Built and tested", ["AI readiness report (Claude, Gemini or rules)", "Investor criteria with explainable fit", "Founder investor search and intro requests", "Discover, saved startups and deal flow", "Deal rooms: chat, NDA, documents, audit log", "Investor and company verification", "Team accounts on both sides", "Funding rounds, allocations, investor updates"]],
    ["NEXT", HEX.accent1, "Pilot phase", ["Production deploy (Render blueprint ready)", "Switch on the AI engine in production", "Email delivery and weekly digests", "Pilots with incubators and angel networks", "Deck view analytics for founders"]],
    ["LATER", HEX.accent3, "Scale", ["Semantic matching with embeddings", "Accelerator programmes and open calls", "Investor pipeline analytics", "CRM and cap-table integrations"]],
  ];
  cols.forEach(([h, col, sub, items], ci) => {
    const x = M + ci * (cw + gap);
    s.addShape(pres.shapes.OVAL, { x, y: y + 0.27, w: 0.16, h: 0.16, fill: { color: col }, line: { type: "none" } });
    T(s, h, { x: x + 0.28, y: y + 0.22, w: cw - 0.28, h: 0.3, fontSize: 12, bold: true, color: col, charSpacing: 2 });
    T(s, sub, { x, y: y + 0.52, w: cw, h: 0.3, fontSize: 13, color: C.text2 });
    T(s, items.map((t, i) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: i < items.length - 1 } })),
      { x, y: y + 0.95, w: cw, h: 3.6, fontSize: 13, paraSpaceAfter: 6 });
  });
  T(s, "Status: working product, pre-launch. No users or revenue yet; the pilot phase is where we validate demand and pricing.", { x: M, y: 6.2, w: CW, h: 0.35, fontSize: 13, bold: true, color: C.text1 });
  s.addNotes("Live today (implemented and covered by tests): readiness report, criteria and fit, founder investor search and intro requests, Discover and deal flow, deal rooms, verification, team accounts, funding rounds and allocations, investor updates and portfolio ledger. Next: deploy via the existing Render blueprint, configure the AI key in production, SMTP email, pilots, deck analytics. Later: embedding-based semantic matching (only a placeholder exists in code today), programmes/open calls, investor analytics, integrations. VentureX is pre-launch with no users or revenue.");
}

// =====================================================================
// 15. CLOSING
// =====================================================================
{
  const s = pres.addSlide({ masterName: "VX Dark", sectionTitle: "Close" });
  T(s, "VentureX", { x: M + 0.1, y: 1.6, w: 8, h: 0.5, fontSize: 18, bold: true, color: C.background1, charSpacing: 1 });
  T(s, [
    { text: "Ready startups.", options: { breakLine: true } },
    { text: "Right investors.", options: { color: "8FA9F0" } },
  ], { x: M + 0.1, y: 2.3, w: 11, h: 2.0, fontSize: 60, bold: true, color: C.background1 });
  T(s, "Helping India's early-stage founders get investor-ready, and helping investors find them.", { x: M + 0.1, y: 4.55, w: 11, h: 0.45, fontSize: 20, color: "C9D2E3" });
  line(s, M + 0.1, 5.55, 3.2, 0, { color: "3A4A66", width: 1 });
  T(s, "Anshitha Yeruva  ·  Nitya Nara", { x: M + 0.1, y: 5.75, w: 8, h: 0.35, fontSize: 14, color: "C9D2E3" });
  s.addNotes("Close: India has over two lakh recognised startups and fewer active investors each year. VentureX makes each conversation count: founders arrive investor-ready, investors see why a startup fits. Thank you.");
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
