import * as math from "mathjs";
import type { GridConfig } from "../types";

/**
 * Preprocess a user-entered expression so that mathjs can parse it.
 * Handles:
 *  - Optional "y = " prefix (strips it)
 *  - Implicit multiplication: 2x → 2*x, 3sin → 3*sin, (a)(b) → (a)*(b)
 *  - Caret exponent is already supported by mathjs
 */
export function preprocessExpression(raw: string): string {
  let expr = raw.trim();

  // Strip optional "y =" or "y=" prefix (case-insensitive)
  expr = expr.replace(/^[yY]\s*=\s*/, "");

  // Implicit multiplication rules (applied in order):
  // 1. number immediately followed by identifier or open-paren: 2x, 2(x+1)
  expr = expr.replace(/(\d)([a-zA-Z(])/g, "$1*$2");
  // 2. closing paren immediately followed by open-paren or identifier: (a)(b), (a)x
  expr = expr.replace(/(\))([a-zA-Z0-9(])/g, "$1*$2");

  return expr;
}

/**
 * Compile an explicit expression string into a function f(x).
 * Returns the compiled function, or throws with a user-friendly message.
 */
export function compileExpression(raw: string): (x: number) => number {
  const expr = preprocessExpression(raw);
  try {
    const compiled = math.compile(expr);
    return (x: number) => {
      const result = compiled.evaluate({ x }) as number;
      if (typeof result !== "number") {
        throw new Error("Expression did not return a number.");
      }
      return result;
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid expression: ${message}`);
  }
}

/**
 * Compile a parametric expression into a function f(t).
 */
export function compileParametricExpr(raw: string): (t: number) => number {
  const expr = preprocessExpression(raw);
  try {
    const compiled = math.compile(expr);
    return (t: number) => {
      const result = compiled.evaluate({ t }) as number;
      if (typeof result !== "number") {
        throw new Error("Expression did not return a number.");
      }
      return result;
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid expression: ${message}`);
  }
}

const EPSILON = 1e-9;
const TICK_PRECISION_DIGITS = 8;

/**
 * Compute the first visible grid tick for a viewport edge/step pair.
 */
export function getGridTickStart(min: number, step: number, epsilon = EPSILON): number {
  return Math.ceil((min - epsilon) / step) * step;
}

/**
 * Build all grid tick values visible in [min, max].
 */
export function buildGridTicks(
  min: number,
  max: number,
  step: number,
  epsilon = EPSILON
): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) {
    return [];
  }
  if (min > max) {
    return [];
  }
  const start = getGridTickStart(min, step, epsilon);
  const tickCount = Math.max(0, Math.floor((max - start) / step) + 1);
  const useIntegerTicks = Number.isInteger(step) && Number.isInteger(start);
  const ticks: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    const value = start + i * step;
    let normalized: number;
    if (Math.abs(value) < epsilon) {
      normalized = 0;
    } else if (useIntegerTicks) {
      normalized = value;
    } else {
      normalized = Number(value.toFixed(TICK_PRECISION_DIGITS));
    }
    ticks.push(normalized);
  }
  return ticks;
}

/**
 * Check whether a value lies on a regular grid step starting at `min`.
 * Uses epsilon tolerance to handle floating-point rounding.
 */
function isOnStep(value: number, tickStart: number, step: number, epsilon: number): boolean {
  const diff = value - tickStart;
  // Normalise remainder to [0, step) to handle negative diffs safely
  const remainder = ((diff % step) + step) % step;
  return remainder < epsilon || Math.abs(remainder - step) < epsilon;
}

/**
 * Return true when the point (x, y) falls exactly on a gridline intersection
 * defined by gridConfig.  Both coordinates are checked against their
 * respective axis step and clamped within the viewport bounds.
 */
export function isGridIntersection(
  x: number,
  y: number,
  gridConfig: GridConfig,
  epsilon = EPSILON
): boolean {
  const { xMin, xMax, xStep, yMin, yMax, yStep } = gridConfig;
  if (x < xMin - epsilon || x > xMax + epsilon) return false;
  if (y < yMin - epsilon || y > yMax + epsilon) return false;
  const xStart = getGridTickStart(xMin, xStep, epsilon);
  const yStart = getGridTickStart(yMin, yStep, epsilon);
  return (
    isOnStep(x, xStart, xStep, epsilon) &&
    isOnStep(y, yStart, yStep, epsilon)
  );
}

/**
 * Check whether a value is (close to) an integer.
 */
export function isInteger(value: number, epsilon = EPSILON): boolean {
  return Math.abs(value - Math.round(value)) < epsilon;
}

/**
 * Compute integer-coordinate lattice points for a parametric curve (x(t), y(t)).
 * Samples t densely and collects unique (x, y) pairs where both are integers.
 * When gridConfig is supplied, only points that fall on a gridline intersection
 * are returned; otherwise all integer-coordinate pairs are included.
 */
export function computeParametricLatticePoints(
  xFn: (t: number) => number,
  yFn: (t: number) => number,
  tMin: number,
  tMax: number,
  gridConfig?: GridConfig
): { x: number; y: number }[] {
  // Use 5000 samples — enough resolution to reliably find integer-coordinate
  // crossings without the cost of the 10000-sample alternative.
  const SAMPLES = 5000;
  const points: { x: number; y: number }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i <= SAMPLES; i++) {
    const t = tMin + (i / SAMPLES) * (tMax - tMin);
    try {
      const x = xFn(t);
      const y = yFn(t);
      if (isFinite(x) && isFinite(y) && isInteger(x) && isInteger(y)) {
        const rx = Math.round(x);
        const ry = Math.round(y);
        if (gridConfig && !isGridIntersection(rx, ry, gridConfig)) continue;
        const key = `${rx},${ry}`;
        if (!seen.has(key)) {
          seen.add(key);
          points.push({ x: rx, y: ry });
        }
      }
    } catch {
      // skip evaluation errors
    }
  }
  return points;
}

/**
 * Compute integer lattice points for y = f(x) over integer x values in range.
 * Returns only points where x and y are both integers.
 * When gridConfig is supplied, only points that fall on a gridline intersection
 * are returned; otherwise all integer-coordinate pairs are included.
 */
export function computeLatticePoints(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  gridConfig?: GridConfig
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const start = Math.ceil(xMin);
  const end = Math.floor(xMax);
  for (let xi = start; xi <= end; xi++) {
    try {
      const yi = fn(xi);
      if (isFinite(yi) && isInteger(yi)) {
        const ry = Math.round(yi);
        if (gridConfig && !isGridIntersection(xi, ry, gridConfig)) continue;
        points.push({ x: xi, y: ry });
      }
    } catch {
      // Skip evaluation errors
    }
  }
  return points;
}

/**
 * Validate an expression and return the error message (or null if valid).
 * Tries evaluating at x=1 to surface symbol-not-found errors early.
 */
export function validateExpression(raw: string): string | null {
  if (!raw.trim()) return null; // empty is silently ignored
  try {
    const fn = compileExpression(raw);
    // Evaluate at x=1 to catch undefined-symbol errors; ignore non-finite results
    try {
      fn(1);
    } catch {
      // Re-try at x=2 to avoid domain errors at x=1 (e.g. log(x-2) at x=1 is undef)
      try {
        fn(2);
      } catch (e2: unknown) {
        return e2 instanceof Error ? e2.message : String(e2);
      }
    }
    return null;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}

/**
 * Validate a parametric expression pair and return error or null.
 */
export function validateParametricExpressions(
  xRaw: string,
  yRaw: string
): string | null {
  if (!xRaw.trim() && !yRaw.trim()) return null;
  try {
    const xExpr = preprocessExpression(xRaw);
    const yExpr = preprocessExpression(yRaw);
    if (!xExpr || !yExpr) return "Both x(t) and y(t) expressions are required.";
    math.compile(xExpr);
    math.compile(yExpr);
    return null;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}
