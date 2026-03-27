import * as math from "mathjs";

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

const EPSILON = 1e-6;

/**
 * Check whether a value is (close to) an integer.
 */
export function isInteger(value: number, epsilon = EPSILON): boolean {
  return Math.abs(value - Math.round(value)) < epsilon;
}

/**
 * Compute integer-coordinate lattice points for a parametric curve (x(t), y(t)).
 * Samples t densely and collects unique (x, y) pairs where both are integers.
 */
export function computeParametricLatticePoints(
  xFn: (t: number) => number,
  yFn: (t: number) => number,
  tMin: number,
  tMax: number
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
 */
export function computeLatticePoints(
  fn: (x: number) => number,
  xMin: number,
  xMax: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const start = Math.ceil(xMin);
  const end = Math.floor(xMax);
  for (let xi = start; xi <= end; xi++) {
    try {
      const yi = fn(xi);
      if (isFinite(yi) && isInteger(yi)) {
        points.push({ x: xi, y: Math.round(yi) });
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
