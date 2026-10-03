import type { FunctionRow } from "../types";
import { validateExpression, validateParametricExpressions } from "../utils/math";
import MathInput from "./MathInput";

interface FunctionRowProps {
  row: FunctionRow;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (id: string, updates: Partial<FunctionRow>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onExportPNG: (id: string) => void;
  onExportPDF: (id: string) => void;
}

const PRESET_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#9333ea", // purple
  "#d97706", // amber
  "#0891b2", // cyan
  "#be185d", // pink
  "#000000", // black
];

export default function FunctionRowComponent({
  row,
  index,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onExportPNG,
  onExportPDF,
}: FunctionRowProps) {
  const thicknessRaw = row.thicknessDraft.trim();
  const thicknessInvalid =
    row.enabled &&
    (!thicknessRaw || !Number.isFinite(Number(thicknessRaw)) || Number(thicknessRaw) <= 0);

  function handleExpressionChange(mathjsExpr: string) {
    const error = validateExpression(mathjsExpr);
    onChange(row.id, { expression: mathjsExpr, error });
  }

  function handleExpressionLatexChange(latex: string) {
    onChange(row.id, { expressionLatex: latex });
  }

  function handleXExprChange(mathjsExpr: string) {
    const error = validateParametricExpressions(mathjsExpr, row.yExpr);
    onChange(row.id, { xExpr: mathjsExpr, parametricError: error });
  }

  function handleXLatexChange(latex: string) {
    onChange(row.id, { xExprLatex: latex });
  }

  function handleYExprChange(mathjsExpr: string) {
    const error = validateParametricExpressions(row.xExpr, mathjsExpr);
    onChange(row.id, { yExpr: mathjsExpr, parametricError: error });
  }

  function handleYLatexChange(latex: string) {
    onChange(row.id, { yExprLatex: latex });
  }

  function handleTypeToggle() {
    onChange(row.id, {
      type: row.type === "explicit" ? "parametric" : "explicit",
      error: null,
      parametricError: null,
    });
  }

  return (
    <div className={`function-row ${row.enabled ? "" : "function-row--disabled"}`}>
      {/* Row header */}
      <div className="function-row__header">
        {/* Enable/disable */}
        <label className="toggle" title="Enable/disable function">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => onChange(row.id, { enabled: e.target.checked })}
          />
          <span className="toggle__track" />
        </label>

        {/* Function index label */}
        <span className="function-row__label">f{index + 1}</span>

        {/* Type toggle */}
        <button
          className={`btn-type ${row.type === "parametric" ? "btn-type--active" : ""}`}
          onClick={handleTypeToggle}
          title="Switch between explicit y=f(x) and parametric x(t),y(t)"
        >
          {row.type === "parametric" ? "param" : "y=f(x)"}
        </button>

        {/* Color picker */}
        <div className="color-controls">
          <div className="color-swatches">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${row.color === c ? "color-swatch--active" : ""}`}
                style={{ background: c }}
                onClick={() => onChange(row.id, { color: c })}
                title={c}
              />
            ))}
          </div>
          <input
            type="color"
            value={row.color}
            onChange={(e) => onChange(row.id, { color: e.target.value })}
            title="Custom color"
            className="color-picker-input"
          />
        </div>

        {/* Thickness */}
        <label className="thickness-label">
          <span>px</span>
          <div className="thickness-controls-inline">
            <input
              type="number"
              min={0.5}
              max={10}
              step={0.5}
              value={row.thicknessDraft}
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = Number(raw);
                if (raw.trim() && Number.isFinite(parsed) && parsed > 0) {
                  onChange(row.id, { thicknessDraft: raw, thickness: parsed });
                  return;
                }
                onChange(row.id, { thicknessDraft: raw });
              }}
              className={`thickness-input ${thicknessInvalid ? "thickness-input--error" : ""}`}
              aria-invalid={thicknessInvalid}
              title="Line thickness (pixels)"
            />
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.5}
              value={Number.isFinite(Number(row.thicknessDraft)) ? Number(row.thicknessDraft) : 2}
              onChange={(e) => {
                const raw = e.target.value;
                onChange(row.id, { thicknessDraft: raw, thickness: Number(raw) });
              }}
              className="drag-slider"
              title="Thickness drag control"
            />
          </div>
        </label>

        {/* Move buttons */}
        <div className="move-buttons">
          <button
            className="btn-icon"
            onClick={() => onMoveUp(row.id)}
            disabled={!canMoveUp}
            title="Move up"
          >
            ▲
          </button>
          <button
            className="btn-icon"
            onClick={() => onMoveDown(row.id)}
            disabled={!canMoveDown}
            title="Move down"
          >
            ▼
          </button>
        </div>

        {/* Export buttons */}
        <div className="export-buttons">
          <button
            className="btn-export"
            onClick={() => onExportPNG(row.id)}
            title="Export this function as PNG"
          >
            PNG
          </button>
          <button
            className="btn-export"
            onClick={() => onExportPDF(row.id)}
            title="Export this function as PDF"
          >
            PDF
          </button>
        </div>

        {/* Remove */}
        <button
          className="btn-remove"
          onClick={() => onRemove(row.id)}
          title="Remove function"
        >
          ✕
        </button>
      </div>

      {/* Expression input */}
      <div className="function-row__body">
        {row.type === "explicit" ? (
          <div className="expr-group">
            <span className="expr-prefix">y =</span>
            <MathInput
              latex={row.expressionLatex}
              onLatexChange={handleExpressionLatexChange}
              onChange={handleExpressionChange}
              placeholder="-2x+1"
              hasError={!!row.error}
            />
          </div>
        ) : (
          <div className="parametric-group">
            <div className="expr-group">
              <span className="expr-prefix">x(t) =</span>
              <MathInput
                latex={row.xExprLatex}
                onLatexChange={handleXLatexChange}
                onChange={handleXExprChange}
                placeholder="\cos\left(t\right)"
                hasError={!!row.parametricError}
              />
            </div>
            <div className="expr-group">
              <span className="expr-prefix">y(t) =</span>
              <MathInput
                latex={row.yExprLatex}
                onLatexChange={handleYLatexChange}
                onChange={handleYExprChange}
                placeholder="\sin\left(t\right)"
                hasError={!!row.parametricError}
              />
            </div>
            <div className="parametric-trange">
              <label>
                t min:
                <input
                  type="number"
                  value={row.tMin}
                  step="any"
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    if (!isNaN(v)) onChange(row.id, { tMin: v });
                  }}
                  className="trange-input"
                />
              </label>
              <label>
                t max:
                <input
                  type="number"
                  value={row.tMax}
                  step="any"
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    if (!isNaN(v)) onChange(row.id, { tMax: v });
                  }}
                  className="trange-input"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
