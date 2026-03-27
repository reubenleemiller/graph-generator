import { useRef, useState, useCallback } from "react";
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
    type: "explicit",
    expression: "",
    error: null,
    xExpr: "",
    yExpr: "",
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
    r.expression = "-2x + 1";
    return [r];
  });
  const [viewport, setViewport] = useState<ViewportConfig>(DEFAULT_VIEWPORT);
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
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setViewport((v) => ({ ...v, [key]: num }));
    }
  }

  function exportSinglePNG(id: string) {
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
    if (!plotRef.current) return;
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
    const canvas = plotRef.current?.getCanvas();
    if (!canvas) return;
    downloadCanvasAsPNG(canvas, "graph_combined.png");
  }

  function exportAllCombinedPDF() {
    const canvas = plotRef.current?.getCanvas();
    if (!canvas) return;
    exportCanvasAsPDF(canvas, "graph_combined.pdf");
  }

  function exportAllFunctionsPDF() {
    if (!plotRef.current) return;
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
                  <input
                    type="number"
                    value={viewport[key]}
                    step={1}
                    onChange={(e) => handleViewportChange(key, e.target.value)}
                    className="viewport-input"
                  />
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
          <PlotCanvas
            ref={plotRef}
            rows={rows}
            viewport={viewport}
            size={540}
            resolution={2}
          />
          <p className="plot-hint">
            ● Points shown only where both x and y are integers.
          </p>
        </section>
      </main>
    </div>
  );
}
