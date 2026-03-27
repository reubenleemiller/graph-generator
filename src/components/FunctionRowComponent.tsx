import type { FunctionRow } from "../types";
import { validateExpression, validateParametricExpressions } from "../utils/math";

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
  function handleExpressionChange(value: string) {
    const error = validateExpression(value);
    onChange(row.id, { expression: value, error });
  }

  function handleXExprChange(value: string) {
    const error = validateParametricExpressions(value, row.yExpr);
    onChange(row.id, { xExpr: value, parametricError: error });
  }

  function handleYExprChange(value: string) {
    const error = validateParametricExpressions(row.xExpr, value);
    onChange(row.id, { yExpr: value, parametricError: error });
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
          <input
            type="number"
            min={0.5}
            max={10}
            step={0.5}
            value={row.thickness}
            onChange={(e) =>
              onChange(row.id, { thickness: parseFloat(e.target.value) || 2 })
            }
            className="thickness-input"
            title="Line thickness (pixels)"
          />
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
            <input
              type="text"
              className={`expr-input ${row.error ? "expr-input--error" : ""}`}
              value={row.expression}
              onChange={(e) => handleExpressionChange(e.target.value)}
              placeholder="e.g. -2x + 1  or  sin(x)  or  x^2 - 3x"
              spellCheck={false}
            />
            {row.error && (
              <span className="expr-error" role="alert">
                {row.error}
              </span>
            )}
          </div>
        ) : (
          <div className="parametric-group">
            <div className="expr-group">
              <span className="expr-prefix">x(t) =</span>
              <input
                type="text"
                className={`expr-input ${row.parametricError ? "expr-input--error" : ""}`}
                value={row.xExpr}
                onChange={(e) => handleXExprChange(e.target.value)}
                placeholder="e.g. cos(t)"
                spellCheck={false}
              />
            </div>
            <div className="expr-group">
              <span className="expr-prefix">y(t) =</span>
              <input
                type="text"
                className={`expr-input ${row.parametricError ? "expr-input--error" : ""}`}
                value={row.yExpr}
                onChange={(e) => handleYExprChange(e.target.value)}
                placeholder="e.g. sin(t)"
                spellCheck={false}
              />
            </div>
            <div className="parametric-trange">
              <label>
                t min:
                <input
                  type="number"
                  value={row.tMin}
                  step={0.1}
                  onChange={(e) =>
                    onChange(row.id, { tMin: parseFloat(e.target.value) || 0 })
                  }
                  className="trange-input"
                />
              </label>
              <label>
                t max:
                <input
                  type="number"
                  value={row.tMax}
                  step={0.1}
                  onChange={(e) =>
                    onChange(row.id, { tMax: parseFloat(e.target.value) || 0 })
                  }
                  className="trange-input"
                />
              </label>
            </div>
            {row.parametricError && (
              <span className="expr-error" role="alert">
                {row.parametricError}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
