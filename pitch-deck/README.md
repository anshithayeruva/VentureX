# VentureX pitch deck

An 8-slide investor pitch (16:9) designed to lead into a live demo of the website. Slides carry headlines and visuals. The explanation, sources and caveats are in each slide's speaker notes.

1. VentureX: Get investor-ready. Meet investors who fit.
2. The problem: two sides, one disconnect
3. The opportunity: 2,07,135 recognised startups; 1,518 tech funding rounds in 2025
4. The solution: founders and investors connected through readiness, explainable matching and deal rooms
5. Differentiation: others solve a step, VentureX connects the journey
6. Business model (proposed) and Now / Next / Future
7. A glimpse of the product: a 96% fit with its reasons (real screen, demo data)
8. Ready startups. Right investors. → live demo path

| File | What it is |
|---|---|
| `VentureX_Pitch_Deck.pptx` | The deck: editable shapes and text, with speaker notes |
| `VentureX_Pitch_Deck.pdf` | PDF preview exported by PowerPoint |
| `slides/slide-NN.png` | Each slide at 1920×1080 |
| `assets/screens/*.png` | Screenshots of the running app (demo data) |
| `src/build_deck.js` | Generates the deck (PptxGenJS, native shapes only) |
| `src/apply_theme.js` | Writes the VentureX colour theme into the .pptx |
| `src/render.ps1` | Saves the PDF and slide PNGs through PowerPoint |
| `src/capture_screens.py` | Re-captures the app screenshots |
| `v1/` and `src/build_deck_v1.js` | The earlier, detailed 15-slide version |

## Capstone deck (`capstone/`)

An 11-slide product and engineering deck for professors and evaluators. It was rebuilt from scratch on 24 Nov 2026. The colours match the VentureX app: warm off-white content slides, deep navy cover and closing slides, the app's blue as the accent and a muted gold used sparingly. The layout takes cues from Linear, with original VentureX branding and a section rail on the left of each slide. It uses freshly captured real screenshots, including a deal room, editable native diagrams, and speaker notes on every slide.

| File | What it is |
|---|---|
| `capstone/VentureX_Capstone_Deck.pptx` / `.pdf` | The deck and its PDF preview |
| `capstone/slides/slide-NN.png`, `capstone/overview.png` | Each slide at 1920×1080, and all 11 on one sheet |
| `capstone/assets/v3_*.png` | Generated navy backgrounds for the cover and closing slides |
| `assets/screens_v2/` | The screenshots and cover snippets the deck uses (demo data) |
| `src/build_capstone.js` | Generator. `VX_ONLY=1,2,9` builds only some slides |
| `src/capture_screens_v2.py` | Re-captures the screenshots, including an accepted intro and a deal room, then removes all demo data and restores the test investor |
| `capstone/previous/`, `src/build_capstone_previous.js` | The version before the rebuild |

```powershell
cd pitch-deck\src
node build_capstone.js
powershell -ExecutionPolicy Bypass -File embed_fonts.ps1 -Deck "..\capstone\VentureX_Capstone_Deck.pptx"
powershell -ExecutionPolicy Bypass -File render.ps1 -Deck "..\capstone\VentureX_Capstone_Deck.pptx" -ImageDir "..\capstone\slides"
```

Fonts match the website (`frontend/app/globals.css`): Newsreader Medium for titles and key figures, Inter for everything else. Both are free Google Fonts (OFL), installed for this Windows user and embedded in the .pptx by `src/embed_fonts.ps1`, so the deck looks right on other computers. To edit the deck on another PC without the fonts, install Inter and Newsreader from fonts.google.com first.

The engineering figures are the API endpoint count (`@router` decorators), route modules, tables (`schema.sql`) and the latest test runs. Update them in the `F` object at the top of the generator when they change.

## Regenerate

Requires Node.js and, for the PDF/PNG export, Microsoft PowerPoint on Windows. Close the deck in PowerPoint first.

```powershell
cd pitch-deck\src
npm install
node build_deck.js
powershell -ExecutionPolicy Bypass -File render.ps1
```

`render.ps1` leaves PowerPoint open if it was already running.

## Re-capture the screenshots (optional)

With the backend (port 8000) and frontend (port 3000) running, and Playwright installed:

```powershell
python pitch-deck\src\capture_screens.py <output-folder>
```

The script signs in with the E2E test accounts from `backend/.env`. It temporarily adds a demo startup ("Sahayak Health"), demo investor criteria and a demo investor name ("Priya Menon, Demo Capital"), takes the screenshots, then deletes the startup and restores the criteria and names. Crop the results into `assets/screens/` with the same file names.

## Accuracy notes

- Product claims match the code (readiness in `backend/app/services/analysis_service.py`, fit scoring in `match_service.py` and `schemas/thesis.py`).
- All pricing on slide 6 is proposed. No monetisation is built.
- Market figures: the DPIIT count is from the Ministry of Commerce & Industry (31 Dec 2025, via The Tribune). Funding rounds and the 39% drop are from Tracxn's 2025 India Tech data (via TechCrunch, 27 Dec 2025). These are separate datasets.
- The competitor dots on slide 5 are based on public product, pricing and help-centre pages (Nov 2026). No signed-in dashboards were inspected.
