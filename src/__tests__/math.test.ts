import { describe, it, expect } from "vitest";
import {
  preprocessExpression,
  compileExpression,
  computeLatticePoints,
  isInteger,
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
    expect(isInteger(2.9999999)).toBe(true);
    expect(isInteger(3.0000001)).toBe(true);
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
