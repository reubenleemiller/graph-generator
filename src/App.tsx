import { useRef, useState, useCallback, useMemo } from "react";
import PlotCanvas from "./components/PlotCanvas";
import type { PlotCanvasHandle } from "./components/PlotCanvas";
import FunctionRowComponent from "./components/FunctionRowComponent";
import type { FunctionRow, ViewportConfig } from "./types";
import {
  downloadCanvasAsPNG,
  exportCanvasAsPDF,
  exportCanvasArrayAsPDF,
} from "./utils/export";
import "./App.css";

let nextId = 1;

function makeDefaultRow(color = "#2563eb"): FunctionRow {
  return {
    id: String(nextId++),
    enabled: true,
    color,
    thickness: 2,
    thicknessDraft: "2",
    type: "explicit",
    expression: "",
    expressionLatex: "",
    error: null,
    xExpr: "",
    xExprLatex: "",
    yExpr: "",
    yExprLatex: "",
    tMin: 0,
    tMax: 2 * Math.PI,
    parametricError: null,
  };
}

const DEFAULT_VIEWPORT: ViewportConfig = {
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5,
};
const VIEWPORT_SLIDER_MIN_RANGE = 100;
// Keep sliders usable at wide zoom levels and when users type large values.
const VIEWPORT_SLIDER_VALUE_SCALE_MULTIPLIER = 2;
const VIEWPORT_SLIDER_VALUE_SCALE_OFFSET = 20;

const COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#d97706",
  "#0891b2",
];

export default function App() {
  const [rows, setRows] = useState<FunctionRow[]>(() => {
    const r = makeDefaultRow();
    return [r];
  });
  const [viewportInputs, setViewportInputs] = useState<Record<keyof ViewportConfig, string>>({
    xMin: String(DEFAULT_VIEWPORT.xMin),
    xMax: String(DEFAULT_VIEWPORT.xMax),
    yMin: String(DEFAULT_VIEWPORT.yMin),
    yMax: String(DEFAULT_VIEWPORT.yMax),
  });
  const [tickInputs, setTickInputs] = useState({
    xStep: "1",
    yStep: "1",
    labelFontSize: "18",
    axisLabelFontSize: "18",
  });
  const [linkMins, setLinkMins] = useState(true);
  const [linkMaxes, setLinkMaxes] = useState(true);
  const plotRef = useRef<PlotCanvasHandle>(null);

  const addRow = useCallback(() => {
    setRows((prev) => {
      const color = COLORS[prev.length % COLORS.length];
      return [...prev, makeDefaultRow(color)];
    });
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateRow = useCallback((id: string, updates: Partial<FunctionRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }, []);

  const moveUp = useCallback((id: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  function handleViewportChange(
    key: keyof ViewportConfig,
    value: string,
    options?: { fromSlider?: boolean }
  ) {
    let nextValue = value;
    if (options?.fromSlider) {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        nextValue = String(Math.round(numericValue));
      }
    }
    setViewportInputs((prev) => {
      const next = { ...prev, [key]: nextValue };
      if (linkMins && (key === "xMin" || key === "yMin")) {
        next.xMin = nextValue;
        next.yMin = nextValue;
      }
      if (linkMaxes && (key === "xMax" || key === "yMax")) {
        next.xMax = nextValue;
        next.yMax = nextValue;
      }
      return next;
    });
  }

  function getViewportSliderRange(key: keyof ViewportConfig): { min: number; max: number } {
    const axis = key.startsWith("x") ? "x" : "y";
    const minKey = axis === "x" ? "xMin" : "yMin";
    const maxKey = axis === "x" ? "xMax" : "yMax";
    const minValue = Number(viewportInputs[minKey]);
    const maxValue = Number(viewportInputs[maxKey]);
    const thisValue = Number(viewportInputs[key]);
    const span = Number.isFinite(minValue) && Number.isFinite(maxValue)
      ? Math.max(maxValue, minValue) - Math.min(maxValue, minValue)
      : VIEWPORT_SLIDER_MIN_RANGE;
    const valueScale = Number.isFinite(thisValue)
      ? Math.abs(thisValue) * VIEWPORT_SLIDER_VALUE_SCALE_MULTIPLIER + VIEWPORT_SLIDER_VALUE_SCALE_OFFSET
      : 0;
    const range = Math.max(VIEWPORT_SLIDER_MIN_RANGE, span * 4, valueScale);
    return { min: -range, max: range };
  }

  function handleTickInputChange(
    key: "xStep" | "yStep" | "labelFontSize" | "axisLabelFontSize",
    value: string
  ) {
    setTickInputs((prev) => ({ ...prev, [key]: value }));
  }

  const viewportValidation = useMemo(() => {
    const keys: (keyof ViewportConfig)[] = ["xMin", "xMax", "yMin", "yMax"];
    const errors: Record<keyof ViewportConfig, string | null> = {
      xMin: null,
      xMax: null,
      yMin: null,
      yMax: null,
    };
    const parsed: Partial<Record<keyof ViewportConfig, number>> = {};

    for (const key of keys) {
      const raw = viewportInputs[key].trim();
      if (!raw) {
        errors[key] = "Required";
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        errors[key] = "Invalid number";
        continue;
      }
      parsed[key] = value;
    }

    if (!errors.xMin && !errors.xMax && parsed.xMin! >= parsed.xMax!) {
      errors.xMin = "Must be less than x max";
      errors.xMax = "Must be greater than x min";
    }

    if (!errors.yMin && !errors.yMax && parsed.yMin! >= parsed.yMax!) {
      errors.yMin = "Must be less than y max";
      errors.yMax = "Must be greater than y min";
    }

    const hasError = keys.some((key) => errors[key] !== null);

    return {
      errors,
      hasError,
      viewport: hasError ? DEFAULT_VIEWPORT : (parsed as ViewportConfig),
    };
  }, [viewportInputs]);

  const hasEquation = useMemo(
    () =>
      rows.some((row) => {
        if (!row.enabled) return false;
        if (row.type === "explicit") return row.expression.trim().length > 0;
        return row.xExpr.trim().length > 0 && row.yExpr.trim().length > 0;
      }),
    [rows]
  );

  const hasInvalidThickness = useMemo(
    () =>
      rows.some((row) => {
        if (!row.enabled) return false;
        const raw = row.thicknessDraft.trim();
        if (!raw) return true;
        const value = Number(raw);
        return !Number.isFinite(value) || value <= 0;
      }),
    [rows]
  );

  const firstEquationError = useMemo(() => {
    for (const row of rows) {
      if (!row.enabled) continue;
      if (row.type === "explicit" && row.error) return row.error;
      if (row.type === "parametric" && row.parametricError) return row.parametricError;
    }
    return null;
  }, [rows]);

  const firstViewportError = useMemo(() => {
    const labels: Record<keyof ViewportConfig, string> = {
      xMin: "x min",
      xMax: "x max",
      yMin: "y min",
      yMax: "y max",
    };
    for (const key of ["xMin", "xMax", "yMin", "yMax"] as (keyof ViewportConfig)[]) {
      const error = viewportValidation.errors[key];
      if (error) return `${labels[key]}: ${error}`;
    }
    return null;
  }, [viewportValidation.errors]);

  const tickValidation = useMemo(() => {
    const errors = {
      xStep: null as string | null,
      yStep: null as string | null,
      labelFontSize: null as string | null,
      axisLabelFontSize: null as string | null,
    };

    const parseStep = (value: string, axisLabel: string): number => {
      const raw = value.trim();
      if (!raw) {
        errors[axisLabel === "x" ? "xStep" : "yStep"] = "Required";
        return 1;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        errors[axisLabel === "x" ? "xStep" : "yStep"] = "Invalid number";
        return 1;
      }
      if (n <= 0) {
        errors[axisLabel === "x" ? "xStep" : "yStep"] = "Must be greater than 0";
        return 1;
      }
      return n;
    };

    const xStep = parseStep(tickInputs.xStep, "x");
    const yStep = parseStep(tickInputs.yStep, "y");

    const parseFontSize = (value: string, key: "labelFontSize" | "axisLabelFontSize"): number => {
      const raw = value.trim();
      if (!raw) {
        errors[key] = "Required";
        return 18;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        errors[key] = "Invalid number";
        return 18;
      }
      if (n < 8 || n > 48) {
        errors[key] = "Must be between 8 and 48";
        return 18;
      }
      return n;
    };

    const tickLabelFontSize = parseFontSize(tickInputs.labelFontSize, "labelFontSize");
    const axisLabelFontSize = parseFontSize(tickInputs.axisLabelFontSize, "axisLabelFontSize");

    return {
      errors,
      xStep,
      yStep,
      tickLabelFontSize,
      axisLabelFontSize,
    };
  }, [tickInputs]);

  const firstTickError = useMemo(() => {
    if (tickValidation.errors.xStep) return `x-axis ticks: ${tickValidation.errors.xStep}`;
    if (tickValidation.errors.yStep) return `y-axis ticks: ${tickValidation.errors.yStep}`;
    if (tickValidation.errors.labelFontSize) return `tick label size: ${tickValidation.errors.labelFontSize}`;
    if (tickValidation.errors.axisLabelFontSize) return `axis label size: ${tickValidation.errors.axisLabelFontSize}`;
    return null;
  }, [
    tickValidation.errors.xStep,
    tickValidation.errors.yStep,
    tickValidation.errors.labelFontSize,
    tickValidation.errors.axisLabelFontSize,
  ]);

  const renderMessage = useMemo(() => {
    if (firstEquationError) return firstEquationError;
    if (!hasEquation) return "Input an equation to render the graph.";
    if (hasInvalidThickness) return "Input a valid px thickness to render the graph.";
    if (firstViewportError) return firstViewportError;
    if (firstTickError) return firstTickError;
    return null;
  }, [firstEquationError, hasEquation, hasInvalidThickness, firstViewportError, firstTickError]);

  const canRenderPlot = renderMessage === null;

  function exportSinglePNG(id: string) {
    if (!canRenderPlot) return;
    const row = rows.find((r) => r.id === id);
    if (!row || !plotRef.current) return;
    const canvas = plotRef.current.renderSingle(row);
    if (!canvas) return;
    const idx = rows.indexOf(row);
    const label =
      row.type === "explicit"
        ? (row.expression || `f${idx + 1}`).replace(/\s/g, "_")
        : `param_f${idx + 1}`;
    downloadCanvasAsPNG(canvas, `graph_${label}.png`);
  }

  function exportAllFunctionsPNG() {
    if (!plotRef.current || !canRenderPlot) return;
    const enabledRows = rows.filter((r) => r.enabled);
    if (enabledRows.length === 0) return;
    enabledRows.forEach((row, i) => {
      const canvas = plotRef.current!.renderSingle(row);
      if (!canvas) return;
      const label =
        row.type === "explicit"
          ? (row.expression || `f${i + 1}`).replace(/\s/g, "_")
          : `param_f${i + 1}_${(row.xExpr || "x").slice(0, 8).replace(/\s/g, "_")}`;
      downloadCanvasAsPNG(canvas, `graph_${label}.png`);
    });
  }

  function exportSinglePDF(id: string) {
    if (!canRenderPlot) return;
    const row = rows.find((r) => r.id === id);
    if (!row || !plotRef.current) return;
    const canvas = plotRef.current.renderSingle(row);
    if (!canvas) return;
    const idx = rows.indexOf(row);
    const label =
      row.type === "explicit"
        ? (row.expression || `f${idx + 1}`).replace(/\s/g, "_")
        : `param_f${idx + 1}`;
    exportCanvasAsPDF(canvas, `graph_${label}.pdf`);
  }

  function exportCombinedPNG() {
    if (!canRenderPlot) return;
    const canvas = plotRef.current?.getCanvas();
    if (!canvas) return;
    downloadCanvasAsPNG(canvas, "graph_combined.png");
  }

  function exportAllCombinedPDF() {
    if (!canRenderPlot) return;
    const canvas = plotRef.current?.getCanvas();
    if (!canvas) return;
    exportCanvasAsPDF(canvas, "graph_combined.pdf");
  }

  function exportAllFunctionsPDF() {
    if (!plotRef.current || !canRenderPlot) return;
    const enabledRows = rows.filter((r) => r.enabled);
    if (enabledRows.length === 0) return;
    const canvasEntries = enabledRows
      .map((row, i) => {
        const canvas = plotRef.current!.renderSingle(row);
        if (!canvas) return null;
        const label =
          row.type === "explicit"
            ? row.expression || `f${i + 1}`
            : `param_f${i + 1}`;
        return { canvas, label };
      })
      .filter(Boolean) as { canvas: HTMLCanvasElement; label: string }[];
    exportCanvasArrayAsPDF(canvasEntries, "graph_all_functions.pdf");
  }

  function resetViewport() {
    setViewportInputs({
      xMin: String(DEFAULT_VIEWPORT.xMin),
      xMax: String(DEFAULT_VIEWPORT.xMax),
      yMin: String(DEFAULT_VIEWPORT.yMin),
      yMax: String(DEFAULT_VIEWPORT.yMax),
    });
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Graph Generator</h1>
        <p className="app__subtitle">
          Desmos‑style function plotter
        </p>
      </header>

      <main className="app__main">
        <section className="panel panel--functions">
          <div className="panel__header">
            <h2>Functions</h2>
            <button className="btn-add" onClick={addRow}>
              + Add function
            </button>
          </div>

          <div className="function-list">
            {rows.map((row, i) => (
              <FunctionRowComponent
                key={row.id}
                row={row}
                index={i}
                canMoveUp={i > 0}
                canMoveDown={i < rows.length - 1}
                onChange={updateRow}
                onRemove={removeRow}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
                onExportPNG={exportSinglePNG}
                onExportPDF={exportSinglePDF}
              />
            ))}
            {rows.length === 0 && (
              <p className="empty-hint">
                No functions yet — click &ldquo;+ Add function&rdquo; to start.
              </p>
            )}
          </div>

          <div className="viewport-controls">
            <div className="viewport-header">
              <h3>Viewport</h3>
              <button className="btn-icon" onClick={resetViewport} type="button">
                Reset
              </button>
            </div>
            <div className="viewport-link-controls">
              <label className="viewport-link-label">
                <input
                  type="checkbox"
                  checked={linkMins}
                  onChange={(e) => setLinkMins(e.target.checked)}
                  aria-label="Link x min and y min values"
                />
                Link mins
              </label>
              <label className="viewport-link-label">
                <input
                  type="checkbox"
                  checked={linkMaxes}
                  onChange={(e) => setLinkMaxes(e.target.checked)}
                  aria-label="Link x max and y max values"
                />
                Link maxes
              </label>
            </div>
            <div className="viewport-grid">
              {(
                [
                  ["xMin", "x min"],
                  ["xMax", "x max"],
                  ["yMin", "y min"],
                  ["yMax", "y max"],
                ] as [keyof ViewportConfig, string][]
              ).map(([key, label]) => {
                const sliderRange = getViewportSliderRange(key);
                return (
                <label key={key} className="viewport-label">
                  <span>{label}</span>
                  <div className="viewport-controls-inline">
                    <input
                      type="number"
                      value={viewportInputs[key]}
                      step={1}
                      onChange={(e) => handleViewportChange(key, e.target.value)}
                      className={`viewport-input ${viewportValidation.errors[key] ? "viewport-input--error" : ""}`}
                      aria-invalid={!!viewportValidation.errors[key]}
                      aria-label={`${label} value`}
                    />
                    <input
                      type="range"
                      min={sliderRange.min}
                      max={sliderRange.max}
                      step={1}
                      value={Number.isFinite(Number(viewportInputs[key])) ? Number(viewportInputs[key]) : 0}
                      onChange={(e) => handleViewportChange(key, e.target.value, { fromSlider: true })}
                      className="drag-slider"
                      title={`${label} drag control`}
                      aria-label={`${label} drag control`}
                    />
                  </div>
                </label>
                );
              })}
            </div>
          </div>

          <div className="axis-tick-controls">
            <h3>Axis Ticks</h3>
            <div className="axis-tick-grid">
              <label className="axis-tick-label">
                <span>x step</span>
                <div className="axis-tick-controls-inline">
                  <input
                    type="number"
                    min={0.1}
                    step="any"
                    value={tickInputs.xStep}
                    onChange={(e) => handleTickInputChange("xStep", e.target.value)}
                    className={`axis-tick-input ${tickValidation.errors.xStep ? "axis-tick-input--error" : ""}`}
                    aria-invalid={!!tickValidation.errors.xStep}
                    aria-label="x-axis tick step value"
                  />
                  <input
                    type="range"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={Number.isFinite(Number(tickInputs.xStep)) && Number(tickInputs.xStep) > 0 ? Number(tickInputs.xStep) : 1}
                    onChange={(e) => handleTickInputChange("xStep", e.target.value)}
                    className="drag-slider"
                    title="x-axis tick step drag control"
                    aria-label="x-axis tick step drag control"
                  />
                </div>
              </label>
              <label className="axis-tick-label">
                <span>y step</span>
                <div className="axis-tick-controls-inline">
                  <input
                    type="number"
                    min={0.1}
                    step="any"
                    value={tickInputs.yStep}
                    onChange={(e) => handleTickInputChange("yStep", e.target.value)}
                    className={`axis-tick-input ${tickValidation.errors.yStep ? "axis-tick-input--error" : ""}`}
                    aria-invalid={!!tickValidation.errors.yStep}
                    aria-label="y-axis tick step value"
                  />
                  <input
                    type="range"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={Number.isFinite(Number(tickInputs.yStep)) && Number(tickInputs.yStep) > 0 ? Number(tickInputs.yStep) : 1}
                    onChange={(e) => handleTickInputChange("yStep", e.target.value)}
                    className="drag-slider"
                    title="y-axis tick step drag control"
                    aria-label="y-axis tick step drag control"
                  />
                </div>
              </label>
              <label className="axis-tick-label">
                <span>label size</span>
                <div className="axis-tick-controls-inline">
                  <input
                    type="number"
                    min={8}
                    max={48}
                    step={1}
                    value={tickInputs.labelFontSize}
                    onChange={(e) => handleTickInputChange("labelFontSize", e.target.value)}
                    className={`axis-tick-input ${tickValidation.errors.labelFontSize ? "axis-tick-input--error" : ""}`}
                    aria-invalid={!!tickValidation.errors.labelFontSize}
                    aria-label="Tick label font size value"
                  />
                  <input
                    type="range"
                    min={8}
                    max={48}
                    step={1}
                    value={
                      Number.isFinite(Number(tickInputs.labelFontSize))
                      && Number(tickInputs.labelFontSize) >= 8
                      && Number(tickInputs.labelFontSize) <= 48
                        ? Number(tickInputs.labelFontSize)
                        : 18
                    }
                    onChange={(e) => handleTickInputChange("labelFontSize", e.target.value)}
                    className="drag-slider"
                    title="tick label font size drag control"
                    aria-label="Tick label font size drag control"
                  />
                </div>
              </label>
              <label className="axis-tick-label">
                <span>axis label</span>
                <div className="axis-tick-controls-inline">
                  <input
                    type="number"
                    min={8}
                    max={48}
                    step={1}
                    value={tickInputs.axisLabelFontSize}
                    onChange={(e) => handleTickInputChange("axisLabelFontSize", e.target.value)}
                    className={`axis-tick-input ${tickValidation.errors.axisLabelFontSize ? "axis-tick-input--error" : ""}`}
                    aria-invalid={!!tickValidation.errors.axisLabelFontSize}
                    aria-label="Axis label font size value"
                  />
                  <input
                    type="range"
                    min={8}
                    max={48}
                    step={1}
                    value={
                      Number.isFinite(Number(tickInputs.axisLabelFontSize))
                      && Number(tickInputs.axisLabelFontSize) >= 8
                      && Number(tickInputs.axisLabelFontSize) <= 48
                        ? Number(tickInputs.axisLabelFontSize)
                        : 18
                    }
                    onChange={(e) => handleTickInputChange("axisLabelFontSize", e.target.value)}
                    className="drag-slider"
                    title="axis label font size drag control"
                    aria-label="Axis label font size drag control"
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="global-export">
            <h3>Export</h3>
            <div className="global-export__buttons">
              <button className="btn-export-main" onClick={exportCombinedPNG}>
                Combined PNG
              </button>
              <button
                className="btn-export-main"
                onClick={exportAllFunctionsPNG}
                title="Each enabled function as a separate PNG download"
              >
                All functions PNG
              </button>
              <button className="btn-export-main" onClick={exportAllCombinedPDF}>
                Combined PDF
              </button>
              <button
                className="btn-export-main"
                onClick={exportAllFunctionsPDF}
                title="Each enabled function on its own PDF page"
              >
                All functions PDF
              </button>
            </div>
          </div>
        </section>

        <section className="panel panel--plot">
          {canRenderPlot ? (
            <PlotCanvas
              ref={plotRef}
              rows={rows}
              viewport={viewportValidation.viewport}
              xTickStep={tickValidation.xStep}
              yTickStep={tickValidation.yStep}
              tickLabelFontSize={tickValidation.tickLabelFontSize}
              axisLabelFontSize={tickValidation.axisLabelFontSize}
              size={540}
              resolution={2}
            />
          ) : (
            <div className="plot-empty-state" role="status">
              {renderMessage}
            </div>
          )}
          <p className="plot-hint">
            ● Points shown only where both x and y are integers.
          </p>
        </section>
      </main>
    </div>
  );
}
