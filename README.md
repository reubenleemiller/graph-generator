# Graph Generator

A React + Vite + TypeScript web app that renders Mathematica‑style function plots with a Desmos‑style multi‑function input panel.

## Features

- **Multi‑function input** – add, remove, and reorder any number of functions.
- **Explicit functions** – enter expressions like `y = -2x + 1`, `sin(x)`, `x^2 - 3x`.
- **Parametric mode** – switch any row to `x(t)`, `y(t)` with a configurable `t`‑range.
- **Mathematica‑style plot** – square aspect ratio, grey gridlines, thick axes with arrowheads, tick labels, border rectangle, serif font labels.
- **Integer lattice points** – black dots drawn only at `(x, f(x))` where *both* x and y are integers (rule B).
- **Per‑function styling** – color picker (preset swatches + custom), line thickness in pixels.
- **Enable / disable toggle** per function row.
- **Adjustable viewport** – `xMin`, `xMax`, `yMin`, `yMax` fields.
- **Export** –
  - Per‑function: PNG or single‑page PDF.
  - All enabled functions: combined PNG, combined PDF (single page), or multi‑page PDF (one function per page).

---

## Installation & running locally

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (hot‑reload)
npm run dev
# → open http://localhost:5173

# 3. Build for production
npm run build

# 4. Preview the production build
npm run preview
```

---

## Running tests

```bash
npm test          # run once
npm run test:watch # watch mode
```

---

## Valid expression syntax

| Input | Interpreted as |
|-------|---------------|
| `y = -2x + 1` | −2x + 1 (y= prefix stripped) |
| `-2x + 1` | −2x + 1 |
| `x^2 - 3x` | x² − 3x |
| `sin(x)` | sine of x |
| `cos(x)` | cosine of x |
| `tan(x)` | tangent of x |
| `sqrt(x)` | square root of x |
| `abs(x)` | absolute value of x |
| `log(x)` | natural log of x |
| `2(x+1)` | 2·(x+1) – implicit multiplication |
| `3sin(x)` | 3·sin(x) – implicit multiplication |
| `(x+1)(x-1)` | (x+1)·(x−1) – implicit multiplication |
| `pi` / `e` | mathematical constants |

Parametric mode uses `t` as the parameter variable.

---

## Export instructions

### Per‑function export
Each function row has two small export buttons in its header:
- **PNG** – downloads a high‑resolution PNG (1080×1080 backing pixels) of *only that function* with the current viewport.
- **PDF** – saves a single‑page A4 PDF with the same plot.

### Combined export (all enabled functions)
In the **Export** section at the bottom of the function panel:
- **Combined PNG** – one PNG with all enabled functions plotted together.
- **Combined PDF** – one A4 page with all functions together.
- **All functions PDF** – multi‑page PDF; each enabled function appears on its own page.

---

## Architecture overview

```
src/
  types/        # TypeScript interfaces (FunctionRow, ViewportConfig)
  utils/
    math.ts     # preprocessExpression, compileExpression, computeLatticePoints, validate…
    export.ts   # downloadCanvasAsPNG, exportCanvasAsPDF, exportCanvasArrayAsPDF
  components/
    PlotCanvas.tsx         # canvas rendering (grid, axes, curves, points)
    FunctionRowComponent.tsx  # per‑row UI (toggle, color, expression input, …)
  App.tsx       # top‑level state management and layout
  __tests__/
    math.test.ts   # unit tests for parsing and lattice‑point selection
```

Dependencies: **mathjs** (expression parsing), **jspdf** (PDF export).
