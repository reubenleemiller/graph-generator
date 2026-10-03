/**
 * Convert a LaTeX string (as produced by MathQuill / mathlive) into a
 * mathjs-parseable expression string.
 *
 * Handles the common cases users would type in a graph-generator context:
 *  - Fractions: \frac{a}{b} → (a)/(b)
 *  - Trig / inverse trig functions
 *  - sqrt, abs, log, ln
 *  - Greek letters: \pi, \e
 *  - Operators: \cdot, \times, \div
 *  - Exponents: ^{...} → ^(...)
 *  - Implicit multiplication (via preprocessExpression)
 */

// Finds the matching closing brace for an opening brace at `startIdx`
// inside the string `s`.  Returns the index of the `}`, or -1 if not found.
function findClosingBrace(s: string, startIdx: number): number {
  let depth = 0;
  for (let i = startIdx; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Recursively expand \frac{...}{...} occurrences inside `s`.
 */
function expandFrac(s: string): string {
  const marker = "\\frac";
  let result = s;
  let idx = result.indexOf(marker);
  while (idx !== -1) {
    const afterFrac = idx + marker.length;
    if (result[afterFrac] !== "{") {
      // malformed; skip
      idx = result.indexOf(marker, idx + 1);
      continue;
    }
    const numEnd = findClosingBrace(result, afterFrac);
    if (numEnd === -1) break;
    const numerator = result.slice(afterFrac + 1, numEnd);

    const denStart = numEnd + 1;
    if (result[denStart] !== "{") {
      idx = result.indexOf(marker, idx + 1);
      continue;
    }
    const denEnd = findClosingBrace(result, denStart);
    if (denEnd === -1) break;
    const denominator = result.slice(denStart + 1, denEnd);

    // Recursively expand within the parts
    const num2 = expandFrac(numerator);
    const den2 = expandFrac(denominator);

    const replacement = `(${num2})/(${den2})`;
    result = result.slice(0, idx) + replacement + result.slice(denEnd + 1);
    idx = result.indexOf(marker);
  }
  return result;
}

/**
 * Expand \sqrt[n]{x} and \sqrt{x}.
 */
function expandSqrt(s: string): string {
  // Process each \sqrt occurrence using findClosingBrace for correctness.
  let result = s;

  // \sqrt[n]{expr} → nthRoot(expr, n)
  let idx = result.indexOf("\\sqrt");
  while (idx !== -1) {
    const afterSqrt = idx + 5;
    if (result[afterSqrt] === "[") {
      // Find closing ]
      const nEnd = result.indexOf("]", afterSqrt + 1);
      if (nEnd !== -1 && result[nEnd + 1] === "{") {
        const exprEnd = findClosingBrace(result, nEnd + 1);
        if (exprEnd !== -1) {
          const n = result.slice(afterSqrt + 1, nEnd);
          const exprContent = result.slice(nEnd + 2, exprEnd);
          result =
            result.slice(0, idx) +
            `nthRoot(${exprContent},${n})` +
            result.slice(exprEnd + 1);
          idx = result.indexOf("\\sqrt");
          continue;
        }
      }
    } else if (result[afterSqrt] === "{") {
      const exprEnd = findClosingBrace(result, afterSqrt);
      if (exprEnd !== -1) {
        const exprContent = result.slice(afterSqrt + 1, exprEnd);
        result =
          result.slice(0, idx) +
          `sqrt(${exprContent})` +
          result.slice(exprEnd + 1);
        idx = result.indexOf("\\sqrt");
        continue;
      }
    }
    idx = result.indexOf("\\sqrt", idx + 1);
  }
  // plain \sqrt without braces (e.g. \sqrt x) — grab next token
  result = result.replace(/\\sqrt\s+([0-9a-zA-Z]+)/g, "sqrt($1)");
  return result;
}

/**
 * Main converter: LaTeX → mathjs expression string.
 */
export function latexToMathjs(latex: string): string {
  let expr = latex.trim();

  // ── Fractions ──────────────────────────────────────────────────────────────
  expr = expandFrac(expr);

  // ── Square root ───────────────────────────────────────────────────────────
  expr = expandSqrt(expr);

  // ── Absolute value using \left| \right| ───────────────────────────────────
  expr = expr.replace(/\\left\s*\|(.+?)\\right\s*\|/gs, "abs($1)");

  // ── \left( ... \right) and related delimiters ────────────────────────────
  expr = expr.replace(/\\left\s*\(/g, "(");
  expr = expr.replace(/\\right\s*\)/g, ")");
  expr = expr.replace(/\\left\s*\[/g, "(");
  expr = expr.replace(/\\right\s*\]/g, ")");
  expr = expr.replace(/\\left\s*\{/g, "(");
  expr = expr.replace(/\\right\s*\}/g, ")");
  expr = expr.replace(/\\left\s*\./g, "");
  expr = expr.replace(/\\right\s*\./g, "");

  // ── Trig and inverse trig ────────────────────────────────────────────────
  const trigFns = [
    "arcsin", "arccos", "arctan",
    "arccsc", "arcsec", "arccot",
    "sinh", "cosh", "tanh", "csch", "sech", "coth",
    "sin", "cos", "tan", "csc", "sec", "cot",
  ];
  for (const fn of trigFns) {
    expr = expr.replace(new RegExp(`\\\\${fn}(?!h)`, "g"), fn);
  }

  // ── log and ln ────────────────────────────────────────────────────────────
  // \log_{base} converted to log base-10 (dropping the base subscript is a
  // simplification; full two-argument log_{b}(x) is complex to parse here).
  expr = expr.replace(/\\log_\{[^}]+\}/g, "log10");
  expr = expr.replace(/\\log/g, "log10");
  expr = expr.replace(/\\ln/g, "log");

  // ── Other functions ───────────────────────────────────────────────────────
  expr = expr.replace(/\\exp/g, "exp");
  expr = expr.replace(/\\abs/g, "abs");
  expr = expr.replace(/\\operatorname\{([^}]+)\}/g, "$1");

  // ── Constants ─────────────────────────────────────────────────────────────
  expr = expr.replace(/\\pi/g, "pi");
  expr = expr.replace(/\\infty/g, "Infinity");
  // \e as Euler's number (isolated, not part of word)
  expr = expr.replace(/\\e(?![a-zA-Z])/g, "e");

  // ── Operators ─────────────────────────────────────────────────────────────
  expr = expr.replace(/\\cdot/g, "*");
  expr = expr.replace(/\\times/g, "*");
  expr = expr.replace(/\\div/g, "/");
  expr = expr.replace(/\\pm/g, "+");   // best-effort

  // ── Exponents with braces: x^{2+n} → x^(2+n) ─────────────────────────────
  expr = expr.replace(/\^\{([^}]+)\}/g, "^($1)");

  // ── Remove remaining LaTeX braces (often used for grouping) ──────────────
  expr = expr.replace(/\{/g, "(").replace(/\}/g, ")");

  // ── Remove backslash before space or remaining unmatched backslashes ──────
  expr = expr.replace(/\\ /g, " ");
  expr = expr.replace(/\\,/g, " ");
  expr = expr.replace(/\\!/g, "");
  expr = expr.replace(/\\;/g, " ");

  // ── Implicit multiplication (from existing preprocessor) ─────────────────
  // number followed by identifier or open-paren: 2x, 2(x+1)
  expr = expr.replace(/(\d)([a-zA-Z(])/g, "$1*$2");
  // closing paren followed by open-paren or identifier: (a)(b), (a)x
  expr = expr.replace(/(\))([a-zA-Z0-9(])/g, "$1*$2");

  return expr;
}
