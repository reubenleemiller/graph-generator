import { describe, it, expect } from "vitest";
import { latexToMathjs } from "../utils/latexToMathjs";
import { compileExpression, compileParametricExpr } from "../utils/math";

describe("latexToMathjs", () => {
  it("passes through plain expressions unchanged (after implicit-mult)", () => {
    expect(latexToMathjs("x+1")).toBe("x+1");
    expect(latexToMathjs("x^2")).toBe("x^2");
  });

  it("converts \\frac{a}{b} to (a)/(b)", () => {
    expect(latexToMathjs("\\frac{1}{x}")).toBe("(1)/(x)");
    expect(latexToMathjs("\\frac{x+1}{x-1}")).toBe("(x+1)/(x-1)");
  });

  it("converts \\sqrt{x} to sqrt(x)", () => {
    expect(latexToMathjs("\\sqrt{x}")).toBe("sqrt(x)");
  });

  it("converts \\pi to pi", () => {
    expect(latexToMathjs("\\pi")).toBe("pi");
  });

  it("converts \\sin, \\cos, \\tan to sin, cos, tan", () => {
    expect(latexToMathjs("\\sin")).toBe("sin");
    expect(latexToMathjs("\\cos")).toBe("cos");
    expect(latexToMathjs("\\tan")).toBe("tan");
  });

  it("removes \\left( \\right)", () => {
    const result = latexToMathjs("\\sin\\left(x\\right)");
    expect(result).toBe("sin(x)");
  });

  it("converts \\cdot to * (evaluates correctly)", () => {
    // "2\cdot x" → "2* x" which mathjs can evaluate
    const result = latexToMathjs("2\\cdot x");
    expect(result).toContain("*");
    // Should evaluate correctly as 2*x
    const fn = compileExpression(result);
    expect(fn(3)).toBeCloseTo(6);
  });

  it("converts exponent braces: x^{2} → x^(2)", () => {
    expect(latexToMathjs("x^{2}")).toBe("x^(2)");
  });

  it("produces evaluable expression for \\frac{1}{x}", () => {
    const mathjs = latexToMathjs("\\frac{1}{x}");
    const fn = compileExpression(mathjs);
    expect(fn(2)).toBeCloseTo(0.5);
  });

  it("produces evaluable parametric expression for \\cos(t)", () => {
    const mathjs = latexToMathjs("\\cos\\left(t\\right)");
    const fn = compileParametricExpr(mathjs);
    expect(fn(0)).toBeCloseTo(1);
    expect(fn(Math.PI)).toBeCloseTo(-1, 5);
  });

  it("produces evaluable expression for x^{2}-3x", () => {
    const mathjs = latexToMathjs("x^{2}-3x");
    const fn = compileExpression(mathjs);
    expect(fn(3)).toBeCloseTo(0);
    expect(fn(0)).toBeCloseTo(0);
    expect(fn(1)).toBeCloseTo(-2);
  });
});
