export type FunctionType = "explicit" | "parametric";

export interface FunctionRow {
  id: string;
  enabled: boolean;
  color: string;
  thickness: number;
  type: FunctionType;
  // Explicit: y = f(x)
  expression: string;
  error: string | null;
  // Parametric
  xExpr: string;
  yExpr: string;
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
