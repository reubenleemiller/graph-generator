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

  function handleViewportChange(key: keyof ViewportConfig, value: string) {
    setViewportInputs((prev) => ({ ...prev, [key]: value }));
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

  const renderMessage = useMemo(() => {
    if (!hasEquation) return "Input an equation to render the graph.";
    if (hasInvalidThickness) return "Input a valid px thickness to render the graph.";
    if (viewportValidation.hasError) {
      return "Input proper bounds to render the plot.";
    }
    return null;
  }, [hasEquation, hasInvalidThickness, viewportValidation.hasError]);

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
            <h3>Viewport</h3>
            <div className="viewport-grid">
              {(
                [
                  ["xMin", "x min"],
                  ["xMax", "x max"],
                  ["yMin", "y min"],
                  ["yMax", "y max"],
                ] as [keyof ViewportConfig, string][]
              ).map(([key, label]) => (
                <label key={key} className="viewport-label">
                  <span>{label}</span>
                  <div className="viewport-field-stack">
                    <div className="viewport-controls-inline">
                      <input
                        type="number"
                        value={viewportInputs[key]}
                        step={1}
                        onChange={(e) => handleViewportChange(key, e.target.value)}
                        className={`viewport-input ${viewportValidation.errors[key] ? "viewport-input--error" : ""}`}
                        aria-invalid={!!viewportValidation.errors[key]}
                      />
                      <input
                        type="range"
                        min={-50}
                        max={50}
                        step={0.5}
                        value={Number.isFinite(Number(viewportInputs[key])) ? Number(viewportInputs[key]) : 0}
                        onChange={(e) => handleViewportChange(key, e.target.value)}
                        className="drag-slider"
                        title={`${label} drag control`}
                      />
                    </div>
                    {viewportValidation.errors[key] && (
                      <span className="field-error-inline">{viewportValidation.errors[key]}</span>
                    )}
                  </div>
                </label>
              ))}
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
