import { describe, it, expect } from "vitest";
import {
  buildGridTicks,
  preprocessExpression,
  compileExpression,
  computeLatticePoints,
  computeParametricLatticePoints,
  isInteger,
  isGridIntersection,
  validateExpression,
} from "../utils/math";

describe("preprocessExpression", () => {
  it("strips 'y = ' prefix", () => {
    expect(preprocessExpression("y = -2x + 1")).toBe("-2*x + 1");
    expect(preprocessExpression("y=-2x+1")).toBe("-2*x+1");
    expect(preprocessExpression("Y = x^2")).toBe("x^2");
  });

  it("adds implicit multiplication for number * identifier", () => {
    expect(preprocessExpression("2x")).toBe("2*x");
    expect(preprocessExpression("3sin(x)")).toBe("3*sin(x)");
    expect(preprocessExpression("2(x+1)")).toBe("2*(x+1)");
  });

  it("adds implicit multiplication for closing * opening paren", () => {
    expect(preprocessExpression("(x+1)(x-1)")).toBe("(x+1)*(x-1)");
  });

  it("does not modify a plain expression", () => {
    expect(preprocessExpression("x^2 - 3*x")).toBe("x^2 - 3*x");
  });

  it("trims whitespace", () => {
    expect(preprocessExpression("  x + 1  ")).toBe("x + 1");
  });
});

describe("compileExpression", () => {
  it("evaluates linear: -2x + 1 at x=0 gives 1", () => {
    const f = compileExpression("-2x + 1");
    expect(f(0)).toBeCloseTo(1);
  });

  it("evaluates linear: -2x + 1 at x=3 gives -5", () => {
    const f = compileExpression("-2x + 1");
    expect(f(3)).toBeCloseTo(-5);
  });

  it("evaluates y = x^2 - 3x at x=3 gives 0", () => {
    const f = compileExpression("y = x^2 - 3x");
    expect(f(3)).toBeCloseTo(0);
  });

  it("evaluates sin(x) at x=0 gives 0", () => {
    const f = compileExpression("sin(x)");
    expect(f(0)).toBeCloseTo(0);
  });

  it("evaluates sqrt(x) at x=4 gives 2", () => {
    const f = compileExpression("sqrt(x)");
    expect(f(4)).toBeCloseTo(2);
  });

  it("evaluates abs(x) at x=-3 gives 3", () => {
    const f = compileExpression("abs(x)");
    expect(f(-3)).toBeCloseTo(3);
  });

  it("returns a function that throws for undefined-symbol expressions", () => {
    // mathjs compiles lazily; the error surfaces on evaluation
    const f = compileExpression("foo + 1");
    expect(() => f(0)).toThrow();
  });
});

describe("isInteger", () => {
  it("returns true for exact integers", () => {
    expect(isInteger(0)).toBe(true);
    expect(isInteger(3)).toBe(true);
    expect(isInteger(-5)).toBe(true);
  });

  it("returns true for values within epsilon of an integer", () => {
    expect(isInteger(2.9999999999)).toBe(true);
    expect(isInteger(3.0000000001)).toBe(true);
  });

  it("returns false for non-integers", () => {
    expect(isInteger(1.5)).toBe(false);
    expect(isInteger(2.1)).toBe(false);
    expect(isInteger(-0.5)).toBe(false);
  });
});

describe("computeLatticePoints", () => {
  it("returns integer lattice points for y = -2x + 1", () => {
    const f = compileExpression("-2x + 1");
    const pts = computeLatticePoints(f, -5, 5);
    // All integer x give integer y for this linear function
    expect(pts.length).toBe(11); // x from -5 to 5 inclusive = 11 points
    // Check specific points
    expect(pts).toContainEqual({ x: 0, y: 1 });
    expect(pts).toContainEqual({ x: 3, y: -5 });
    expect(pts).toContainEqual({ x: -5, y: 11 });
  });

  it("returns only points in-range for y = x^2 - 3x", () => {
    const f = compileExpression("x^2 - 3x");
    const pts = computeLatticePoints(f, -5, 5);
    // All integer x values give integer y for this polynomial
    expect(pts.length).toBe(11);
    // x=3: 9 - 9 = 0
    expect(pts).toContainEqual({ x: 3, y: 0 });
    // x=0: 0
    expect(pts).toContainEqual({ x: 0, y: 0 });
  });

  it("skips non-integer y values", () => {
    // f(x) = x + 0.5 — y is never an integer for integer x
    const f = (_x: number) => _x + 0.5;
    const pts = computeLatticePoints(f, -5, 5);
    expect(pts.length).toBe(0);
  });

  it("handles sqrt(x) — only exact integer results are included", () => {
    const f = compileExpression("sqrt(x)");
    const pts = computeLatticePoints(f, 0, 10);
    // sqrt(0)=0, sqrt(1)=1, sqrt(4)=2, sqrt(9)=3
    expect(pts).toContainEqual({ x: 0, y: 0 });
    expect(pts).toContainEqual({ x: 1, y: 1 });
    expect(pts).toContainEqual({ x: 4, y: 2 });
    expect(pts).toContainEqual({ x: 9, y: 3 });
    // sqrt(2), sqrt(3) etc. should not be included
    expect(pts.find((p) => p.x === 2)).toBeUndefined();
  });
});

describe("validateExpression", () => {
  it("returns null for valid expressions", () => {
    expect(validateExpression("-2x + 1")).toBeNull();
    expect(validateExpression("sin(x)")).toBeNull();
    expect(validateExpression("y = x^2")).toBeNull();
    expect(validateExpression("")).toBeNull(); // empty is silent
  });

  it("returns error string for invalid expressions", () => {
    const err = validateExpression("???");
    expect(err).not.toBeNull();
    expect(typeof err).toBe("string");
  });
});

describe("isGridIntersection", () => {
  const grid = { xMin: 0, xMax: 15, xStep: 1, yMin: 0, yMax: 60, yStep: 5 };

  it("returns true for a point on a gridline intersection", () => {
    expect(isGridIntersection(3, 10, grid)).toBe(true);
    expect(isGridIntersection(0, 0, grid)).toBe(true);
    expect(isGridIntersection(15, 60, grid)).toBe(true);
  });

  it("returns false for a point with y not on y-step", () => {
    expect(isGridIntersection(3, 11, grid)).toBe(false);
    expect(isGridIntersection(0, 1, grid)).toBe(false);
  });

  it("returns false for a point outside the viewport", () => {
    expect(isGridIntersection(-1, 0, grid)).toBe(false);
    expect(isGridIntersection(3, 65, grid)).toBe(false);
  });

  it("works when xMin and yMin are non-zero", () => {
    const shifted = { xMin: 2, xMax: 12, xStep: 2, yMin: 1, yMax: 21, yStep: 4 };
    // x=2,4,6,...; y=4,8,12,...
    expect(isGridIntersection(4, 8, shifted)).toBe(true);
    expect(isGridIntersection(3, 8, shifted)).toBe(false); // x not on step
    expect(isGridIntersection(4, 9, shifted)).toBe(false); // y not on step
  });

  it("matches tick placement when viewport mins are fractional", () => {
    const shifted = { xMin: 0.2, xMax: 5.2, xStep: 1, yMin: -0.2, yMax: 5.2, yStep: 1 };
    // Drawn ticks start at 1 for x and 0 for y, so (2,3) is on a grid intersection.
    expect(isGridIntersection(2, 3, shifted)).toBe(true);
  });
});

describe("computeLatticePoints with gridConfig", () => {
  // y = 4x + 10 (matches the Mathematica example in the issue)
  const f = compileExpression("4x + 10");
  const grid = { xMin: 0, xMax: 15, xStep: 1, yMin: 0, yMax: 60, yStep: 5 };

  it("excludes integer points whose y is not on the y-grid step", () => {
    // For y = 4x + 10: y is always even.  With yStep=5 only y divisible by 5
    // that is also in range [0, 60] qualifies.
    // 4x+10 = multiple of 5 ⟹ 4x ≡ 0 (mod 5) ⟹ x ≡ 0 (mod 5): x=0,5,10
    const pts = computeLatticePoints(f, 0, 15, grid);
    expect(pts).toContainEqual({ x: 0, y: 10 });
    expect(pts).toContainEqual({ x: 5, y: 30 });
    expect(pts).toContainEqual({ x: 10, y: 50 });
    // x=1 gives y=14 — integer but NOT on yStep=5 → excluded
    expect(pts.find((p) => p.x === 1)).toBeUndefined();
  });

  it("excludes points with y outside [yMin, yMax]", () => {
    // x=15 gives y=70, which exceeds yMax=60
    const pts = computeLatticePoints(f, 0, 15, grid);
    expect(pts.find((p) => p.x === 15)).toBeUndefined();
  });

  it("changing yStep to 2 changes the set of valid points", () => {
    const grid2 = { ...grid, yStep: 2 };
    // y = 4x + 10; y is always even, so every integer x in [0,15] (giving y in [0,60]) qualifies
    const pts = computeLatticePoints(f, 0, 15, grid2);
    expect(pts).toContainEqual({ x: 1, y: 14 }); // y=14 is on yStep=2
    expect(pts).toContainEqual({ x: 5, y: 30 });
  });

  it("without gridConfig returns all integer-coordinate points (backwards compatible)", () => {
    // All integer x in [0,15] give integer y, 16 points total
    const pts = computeLatticePoints(f, 0, 15);
    expect(pts.length).toBe(16);
  });
});

describe("computeParametricLatticePoints with gridConfig", () => {
  const grid = { xMin: 0, xMax: 10, xStep: 1, yMin: 0, yMax: 20, yStep: 2 };
  // x(t) = t, y(t) = 2t — lattice points at integer t where y is even
  const xFn = (t: number) => t;
  const yFn = (t: number) => 2 * t;

  it("includes points on grid intersections", () => {
    const pts = computeParametricLatticePoints(xFn, yFn, 0, 10, grid);
    expect(pts).toContainEqual({ x: 3, y: 6 });
    expect(pts).toContainEqual({ x: 0, y: 0 });
  });

  it("excludes points whose y is not on yStep", () => {
    // Use yStep=3 to exclude points where 2t is not divisible by 3.
    const grid3 = { ...grid, yStep: 3 };
    const pts = computeParametricLatticePoints(xFn, yFn, 0, 10, grid3);
    // 2t divisible by 3 when t=0,3,6,9
    expect(pts).toContainEqual({ x: 0, y: 0 });
    expect(pts).toContainEqual({ x: 3, y: 6 });
    expect(pts.find((p) => p.x === 1)).toBeUndefined(); // y=2, not on yStep=3
  });

  it("without gridConfig returns all integer-coordinate points (backwards compatible)", () => {
    const pts = computeParametricLatticePoints(xFn, yFn, 0, 5);
    // t=0..5 gives (0,0),(1,2),(2,4),(3,6),(4,8),(5,10) — all included
    expect(pts.length).toBe(6);
  });
});

describe("fractional viewport offsets", () => {
  it("keeps explicit lattice points aligned with rendered integer gridlines", () => {
    const f = compileExpression("x");
    const grid = { xMin: 0.2, xMax: 5.2, xStep: 1, yMin: 0.2, yMax: 5.2, yStep: 1 };
    const pts = computeLatticePoints(f, 0.2, 5.2, grid);
    expect(pts).toContainEqual({ x: 1, y: 1 });
    expect(pts).toContainEqual({ x: 5, y: 5 });
  });

  it("keeps parametric lattice points aligned with rendered integer gridlines", () => {
    const grid = { xMin: 0.2, xMax: 5.2, xStep: 1, yMin: 0.2, yMax: 5.2, yStep: 1 };
    const pts = computeParametricLatticePoints((t) => t, (t) => t, 0.2, 5.2, grid);
    expect(pts).toContainEqual({ x: 1, y: 1 });
    expect(pts).toContainEqual({ x: 5, y: 5 });
  });
});

describe("buildGridTicks", () => {
  it("includes all in-range ticks without fixed caps", () => {
    const ticks = buildGridTicks(0, 5000, 1);
    expect(ticks.length).toBe(5001);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(5000);
  });
});
