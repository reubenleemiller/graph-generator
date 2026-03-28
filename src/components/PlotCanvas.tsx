import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from "react";
import type { FunctionRow, ViewportConfig } from "../types";
import {
  compileExpression,
  compileParametricExpr,
  computeLatticePoints,
  computeParametricLatticePoints,
} from "../utils/math";

export interface PlotCanvasHandle {
  getCanvas(): HTMLCanvasElement | null;
  renderSingle(row: FunctionRow): HTMLCanvasElement | null;
}

interface PlotCanvasProps {
  rows: FunctionRow[];
  viewport: ViewportConfig;
  xTickStep?: number;
  yTickStep?: number;
  tickLabelFontSize?: number;
  axisLabelFontSize?: number;
  size?: number; // CSS pixel size of the canvas
  resolution?: number; // backing pixel multiplier for HiDPI
}

const PLOT_PADDING = 48; // pixels (inside canvas) for axes/ticks
const TICK_SIZE = 6;
const TICK_WIDTH = 1.8;
const FONT_FAMILY = "Times New Roman, serif";
const TICK_LABEL_GAP = 4;
const CANVAS_TEXT_MARGIN = 6;

function drawPlot(
  ctx: CanvasRenderingContext2D,
  rows: FunctionRow[],
  viewport: ViewportConfig,
  xTickStep: number,
  yTickStep: number,
  tickLabelFontSize: number,
  axisLabelFontSize: number,
  canvasSize: number
): void {
  const { xMin, xMax, yMin, yMax } = viewport;
  const plotSize = canvasSize - PLOT_PADDING * 2;
  const EPSILON = 1e-9;

  function buildTicks(min: number, max: number, step: number): number[] {
    if (!Number.isFinite(step) || step <= 0) return [];
    const ticks: number[] = [];
    const start = Math.ceil((min - EPSILON) / step) * step;
    const maxTicks = 2000;
    for (let i = 0; i < maxTicks; i++) {
      const value = start + i * step;
      if (value > max + EPSILON) break;
      const normalized = Math.abs(value) < EPSILON ? 0 : Number(value.toFixed(8));
      ticks.push(normalized);
    }
    return ticks;
  }

  function formatTickValue(value: number): string {
    if (Math.abs(value) < EPSILON) return "0";
    const normalized = Number(value.toFixed(6));
    return Number.isInteger(normalized)
      ? String(normalized)
      : normalized.toString().replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  const xTicks = buildTicks(xMin, xMax, xTickStep);
  const yTicks = buildTicks(yMin, yMax, yTickStep);

  // Helper: math coords → canvas coords
  function toCanvasX(x: number): number {
    return PLOT_PADDING + ((x - xMin) / (xMax - xMin)) * plotSize;
  }
  function toCanvasY(y: number): number {
    return PLOT_PADDING + ((yMax - y) / (yMax - yMin)) * plotSize;
  }

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // ── Grid lines ──────────────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = "rgba(128,128,128,0.6)";
  ctx.lineWidth = 1.4;

  for (const gx of xTicks) {
    const cx = toCanvasX(gx);
    ctx.beginPath();
    ctx.moveTo(cx, PLOT_PADDING);
    ctx.lineTo(cx, PLOT_PADDING + plotSize);
    ctx.stroke();
  }

  for (const gy of yTicks) {
    const cy = toCanvasY(gy);
    ctx.beginPath();
    ctx.moveTo(PLOT_PADDING, cy);
    ctx.lineTo(PLOT_PADDING + plotSize, cy);
    ctx.stroke();
  }
  ctx.restore();

  // ── Axes ─────────────────────────────────────────────────────────────────────
  const axisLineWidth = 2.2;
  const arrowSize = 10;

  function drawArrow(
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - arrowSize * Math.cos(angle - Math.PI / 7),
      y2 - arrowSize * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      x2 - arrowSize * Math.cos(angle + Math.PI / 7),
      y2 - arrowSize * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();
  }

  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#000";
  ctx.lineWidth = axisLineWidth;

  // Clamp axis crossing to within viewport
  const axisY = Math.max(yMin, Math.min(yMax, 0));
  const axisX = Math.max(xMin, Math.min(xMax, 0));

  const xAxisY = toCanvasY(axisY);
  const yAxisX = toCanvasX(axisX);

  // Extend slightly beyond the plot for arrowhead
  const overshoot = 12;

  // X axis
  drawArrow(
    PLOT_PADDING,
    xAxisY,
    PLOT_PADDING + plotSize + overshoot,
    xAxisY
  );
  // Y axis
  drawArrow(
    yAxisX,
    PLOT_PADDING + plotSize,
    yAxisX,
    PLOT_PADDING - overshoot
  );
  ctx.restore();

  // ── Tick marks & labels ──────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#000";
  ctx.lineWidth = TICK_WIDTH;
  ctx.font = `${tickLabelFontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const xAxisYCanvas = toCanvasY(axisY);
  const yAxisXCanvas = toCanvasX(axisX);

  const xLabelsBelowAxis = xAxisYCanvas + TICK_SIZE + TICK_LABEL_GAP + tickLabelFontSize <= canvasSize - CANVAS_TEXT_MARGIN;
  const xLabelBaseline = xLabelsBelowAxis ? "top" : "bottom";
  const xLabelY = xLabelsBelowAxis
    ? xAxisYCanvas + TICK_SIZE + TICK_LABEL_GAP
    : xAxisYCanvas - TICK_SIZE - TICK_LABEL_GAP;

  for (const tx of xTicks) {
    if (Math.abs(tx) < EPSILON) continue;
    const cx = toCanvasX(tx);
    ctx.beginPath();
    ctx.moveTo(cx, xAxisYCanvas - TICK_SIZE);
    ctx.lineTo(cx, xAxisYCanvas + TICK_SIZE);
    ctx.stroke();
    ctx.textBaseline = xLabelBaseline;
    ctx.fillText(formatTickValue(tx), cx, xLabelY);
  }

  const yLabelsLeftOfAxis = yAxisXCanvas - TICK_SIZE - TICK_LABEL_GAP - 28 >= CANVAS_TEXT_MARGIN;
  ctx.textAlign = yLabelsLeftOfAxis ? "right" : "left";
  ctx.textBaseline = "middle";
  for (const ty of yTicks) {
    if (Math.abs(ty) < EPSILON) continue;
    const cy = toCanvasY(ty);
    ctx.beginPath();
    ctx.moveTo(yAxisXCanvas - TICK_SIZE, cy);
    ctx.lineTo(yAxisXCanvas + TICK_SIZE, cy);
    ctx.stroke();
    const yLabelX = yLabelsLeftOfAxis
      ? yAxisXCanvas - TICK_SIZE - TICK_LABEL_GAP
      : yAxisXCanvas + TICK_SIZE + TICK_LABEL_GAP;
    ctx.fillText(formatTickValue(ty), yLabelX, cy);
  }
  ctx.restore();

  // ── Axis labels ──────────────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.font = `${axisLabelFontSize}px ${FONT_FAMILY}`;

  // "x" label at the right end of x-axis
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("x", PLOT_PADDING + plotSize + overshoot + 5, xAxisYCanvas);

  // "y" label at the top of y-axis
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("y", yAxisXCanvas, PLOT_PADDING - overshoot - 2);
  ctx.restore();

  // ── Border rectangle ─────────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(PLOT_PADDING, PLOT_PADDING, plotSize, plotSize);
  ctx.restore();

  // ── Function curves & lattice points ─────────────────────────────────────────
  const SAMPLES = 1000;

  // Clip all curves (and lattice dots) to the plot area so nothing exits the frame
  ctx.save();
  ctx.beginPath();
  ctx.rect(PLOT_PADDING, PLOT_PADDING, plotSize, plotSize);
  ctx.clip();

  for (const row of rows) {
    if (!row.enabled) continue;

    ctx.save();
    ctx.strokeStyle = row.color;
    ctx.lineWidth = row.thickness;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (row.type === "explicit") {
      if (!row.expression.trim()) {
        ctx.restore();
        continue;
      }
      let fn: ((x: number) => number) | null = null;
      try {
        fn = compileExpression(row.expression);
      } catch {
        ctx.restore();
        continue;
      }

      // Draw curve
      ctx.beginPath();
      let penDown = false;
      for (let i = 0; i <= SAMPLES; i++) {
        const x = xMin + (i / SAMPLES) * (xMax - xMin);
        let y: number;
        try {
          y = fn(x);
        } catch {
          penDown = false;
          continue;
        }
        if (!isFinite(y) || y < yMin - 10 || y > yMax + 10) {
          penDown = false;
          continue;
        }
        const cx = toCanvasX(x);
        const cy = toCanvasY(y);
        if (!penDown) {
          ctx.moveTo(cx, cy);
          penDown = true;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      ctx.stroke();

      // Lattice points
      const lattice = computeLatticePoints(fn, xMin, xMax);
      ctx.fillStyle = "#000";
      for (const { x, y } of lattice) {
        if (y < yMin || y > yMax) continue;
        const cx = toCanvasX(x);
        const cy = toCanvasY(y);
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Parametric
      if (!row.xExpr.trim() || !row.yExpr.trim()) {
        ctx.restore();
        continue;
      }
      let xFn: ((t: number) => number) | null = null;
      let yFn: ((t: number) => number) | null = null;
      try {
        xFn = compileParametricExpr(row.xExpr);
        yFn = compileParametricExpr(row.yExpr);
      } catch {
        ctx.restore();
        continue;
      }

      ctx.beginPath();
      let penDown = false;
      for (let i = 0; i <= SAMPLES; i++) {
        const t = row.tMin + (i / SAMPLES) * (row.tMax - row.tMin);
        let px: number;
        let py: number;
        try {
          px = xFn(t);
          py = yFn(t);
        } catch {
          penDown = false;
          continue;
        }
        if (
          !isFinite(px) ||
          !isFinite(py) ||
          px < xMin - 10 ||
          px > xMax + 10 ||
          py < yMin - 10 ||
          py > yMax + 10
        ) {
          penDown = false;
          continue;
        }
        const cx = toCanvasX(px);
        const cy = toCanvasY(py);
        if (!penDown) {
          ctx.moveTo(cx, cy);
          penDown = true;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      ctx.stroke();

      // Parametric lattice points
      const lattice = computeParametricLatticePoints(xFn, yFn, row.tMin, row.tMax);
      ctx.fillStyle = "#000";
      for (const { x, y } of lattice) {
        if (x < xMin || x > xMax || y < yMin || y > yMax) continue;
        const cx = toCanvasX(x);
        const cy = toCanvasY(y);
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // Remove curve clip so the border rectangle is drawn unclipped
  ctx.restore();
}

const PlotCanvas = forwardRef<PlotCanvasHandle, PlotCanvasProps>(
  function PlotCanvas(
    {
      rows,
      viewport,
      xTickStep = 1,
      yTickStep = 1,
      tickLabelFontSize = 18,
      axisLabelFontSize = 18,
      size = 540,
      resolution = 2,
    },
    ref
  ) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [displaySize, setDisplaySize] = useState(size);
    const backingSize = displaySize * resolution;

    useEffect(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const updateSize = (): void => {
        const width = Math.floor(wrapper.getBoundingClientRect().width);
        if (!Number.isFinite(width) || width <= 0) return;
        setDisplaySize(Math.min(size, width));
      };

      updateSize();

      const observer = new ResizeObserver(() => {
        updateSize();
      });
      observer.observe(wrapper);

      return () => {
        observer.disconnect();
      };
    }, [size]);

    const render = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.scale(resolution, resolution);
      drawPlot(
        ctx,
        rows,
        viewport,
        xTickStep,
        yTickStep,
        tickLabelFontSize,
        axisLabelFontSize,
        displaySize
      );
      ctx.restore();
    }, [
      rows,
      viewport,
      xTickStep,
      yTickStep,
      tickLabelFontSize,
      axisLabelFontSize,
      displaySize,
      resolution,
    ]);

    useEffect(() => {
      render();
    }, [render]);

    useImperativeHandle(ref, () => ({
      getCanvas(): HTMLCanvasElement | null {
        return canvasRef.current;
      },
      renderSingle(row: FunctionRow): HTMLCanvasElement | null {
        const exportBackingSize = size * resolution;
        const offscreen = document.createElement("canvas");
        offscreen.width = exportBackingSize;
        offscreen.height = exportBackingSize;
        const ctx = offscreen.getContext("2d");
        if (!ctx) return null;
        ctx.save();
        ctx.scale(resolution, resolution);
        drawPlot(
          ctx,
          [row],
          viewport,
          xTickStep,
          yTickStep,
          tickLabelFontSize,
          axisLabelFontSize,
          size
        );
        ctx.restore();
        return offscreen;
      },
    }));

    return (
      <div ref={wrapperRef} className="plot-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={backingSize}
          height={backingSize}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      </div>
    );
  }
);

export default PlotCanvas;
