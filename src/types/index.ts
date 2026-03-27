export type FunctionType = "explicit" | "parametric";

export interface FunctionRow {
  id: string;
  enabled: boolean;
  color: string;
  thickness: number;
  type: FunctionType;
  // Explicit: y = f(x)
  expression: string;       // mathjs-parseable expression
  expressionLatex: string;  // raw LaTeX from WYSIWYG editor
  error: string | null;
  // Parametric
  xExpr: string;            // mathjs-parseable x(t) expression
  xExprLatex: string;       // raw LaTeX from WYSIWYG editor
  yExpr: string;            // mathjs-parseable y(t) expression
  yExprLatex: string;       // raw LaTeX from WYSIWYG editor
  tMin: number;
  tMax: number;
  parametricError: string | null;
}

export interface ViewportConfig {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}
