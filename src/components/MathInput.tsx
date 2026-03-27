/**
 * MathInput — a WYSIWYG math-field editor powered by MathLive.
 *
 * Renders a <math-field> web-component with Desmos-like appearance.
 * Exposes the current LaTeX via `onLatexChange` and a pre-converted
 * mathjs expression string via `onChange`.
 */
import { useEffect, useRef } from "react";
// Importing mathlive registers the <math-field> custom element globally.
import "mathlive";
import type { MathfieldElement } from "mathlive";
import { latexToMathjs } from "../utils/latexToMathjs";

// Tell TypeScript about the <math-field> custom element in JSX.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement> & {
          /** Initial / controlled LaTeX value */
          value?: string;
          placeholder?: string;
        },
        MathfieldElement
      >;
    }
  }
}

interface MathInputProps {
  /** Current LaTeX string value */
  latex: string;
  /** Called with the new LaTeX whenever the user edits the field */
  onLatexChange: (latex: string) => void;
  /** Called with mathjs-compatible expression on each change */
  onChange: (mathjs: string) => void;
  placeholder?: string;
  hasError?: boolean;
  className?: string;
}

export default function MathInput({
  latex,
  onLatexChange,
  onChange,
  placeholder = "",
  hasError = false,
  className = "",
}: MathInputProps) {
  const ref = useRef<MathfieldElement>(null);
  // Track the last latex we set so we don't re-set it while the user is
  // typing (which would reset the cursor position).
  const lastSetLatex = useRef<string>(latex);
  // Store latest callbacks in refs so the mount-only effect always calls
  // the current version without needing to re-register the listener.
  const onLatexChangeRef = useRef(onLatexChange);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onLatexChangeRef.current = onLatexChange; }, [onLatexChange]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Only update the field value from outside when the prop actually changes
  // AND the field isn't currently focused (to avoid caret resets mid-edit).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (latex !== lastSetLatex.current) {
      // Only override if the field doesn't have focus
      if (document.activeElement !== el) {
        el.value = latex;
        lastSetLatex.current = latex;
      }
    }
  }, [latex]);

  // Set up the input listener once on mount.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Set initial value
    el.value = latex;
    lastSetLatex.current = latex;

    // Hide the virtual keyboard on desktop (it can pop up unexpectedly)
    el.setAttribute("math-virtual-keyboard-policy", "manual");

    function handleInput() {
      const newLatex = el!.value;
      lastSetLatex.current = newLatex;
      onLatexChangeRef.current(newLatex);
      onChangeRef.current(latexToMathjs(newLatex));
    }

    el.addEventListener("input", handleInput);
    return () => {
      el.removeEventListener("input", handleInput);
    };
    // The effect runs only once on mount so that the MathLive listener is
    // registered once and the initial value is set.  The callbacks
    // (onLatexChange / onChange) are expected to be stable references
    // (created with useCallback in parent) so capturing them on mount is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <math-field
      ref={ref as React.RefObject<MathfieldElement>}
      className={`math-input ${hasError ? "math-input--error" : ""} ${className}`.trim()}
      placeholder={placeholder}
    />
  );
}
