/**
 * Translates LaTeX math expressions into mathjs-compatible strings.
 *
 * The AI OCR model outputs LaTeX (e.g. `\frac{1}{2}`, `x^{2}`, `\times`).
 * mathjs expects plain infix notation (`1/2`, `x^2`, `*`).
 *
 * This is intentionally a _best-effort_ translator for common K-12 / university
 * expressions — not a full LaTeX parser. Edge cases should be reported and
 * the mapping table extended incrementally.
 */

/**
 * Clean raw LaTeX OCR output before translation.
 * Strips surrounding `$...$` or `$$...$$`, display-mode commands, etc.
 */
export function cleanLatex(raw: string): string {
  let s = raw.trim();

  // Strip display math wrappers
  if (s.startsWith("$$") && s.endsWith("$$")) s = s.slice(2, -2).trim();
  else if (s.startsWith("$") && s.endsWith("$")) s = s.slice(1, -1).trim();

  // Strip \[...\] and \(...\) display-math delimiters (common TexTeller3 output)
  s = s.replace(/^\\\[/, "").replace(/\\\]$/, "").trim();
  s = s.replace(/^\\\(/, "").replace(/\\\)$/, "").trim();

  // Strip \displaystyle, \textstyle, etc.
  s = s.replace(/\\(displaystyle|textstyle|scriptstyle)\s*/g, "");

  // Strip \left / \right delimiters but keep the bracket character
  s = s.replace(/\\(left|right)\s*([()[\]|{}.])/g, "$2");

  return s;
}

/**
 * Translate a cleaned LaTeX string into a mathjs expression string.
 *
 * @param latex - Cleaned LaTeX (output of `cleanLatex`)
 * @returns A string that can be fed to `mathjs.evaluate()` / `parser.evaluate()`
 */
export function latexToMathjs(latex: string): string {
  let expr = latex;

  // ── Fractions: \frac{a}{b} → (a)/(b) ──
  // Handle nested fractions by iterating until stable
  const fracRe = /\\frac\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/;
  let safety = 0;
  while (fracRe.test(expr) && safety++ < 20) {
    expr = expr.replace(fracRe, "($1)/($2)");
  }

  // ── Square root: \sqrt{x} → sqrt(x), \sqrt[n]{x} → nthRoot(x, n) ──
  expr = expr.replace(
    /\\sqrt\[([^\]]+)\]\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    "nthRoot($2, $1)"
  );
  expr = expr.replace(
    /\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    "sqrt($1)"
  );

  // ── Superscript: x^{expr} → x^(expr), single char x^2 stays ──
  expr = expr.replace(/\^{([^{}]+)}/g, "^($1)");

  // ── Subscripts (strip for evaluation): x_{n} → x_n (or just x) ──
  expr = expr.replace(/_{([^{}]+)}/g, "_$1");

  // ── Common LaTeX operators → mathjs equivalents ──
  expr = expr.replace(/\\times/g, "*");
  expr = expr.replace(/\\cdot/g, "*");
  expr = expr.replace(/\\div/g, "/");
  expr = expr.replace(/\\pm/g, "±"); // kept as-is for display; mathjs doesn't support ±
  expr = expr.replace(/\\neq/g, "!=");
  expr = expr.replace(/\\leq/g, "<=");
  expr = expr.replace(/\\geq/g, ">=");
  expr = expr.replace(/\\lt/g, "<");
  expr = expr.replace(/\\gt/g, ">");

  // ── Trigonometric & common functions ──
  const functions = [
    "sin",
    "cos",
    "tan",
    "cot",
    "sec",
    "csc",
    "arcsin",
    "arccos",
    "arctan",
    "ln",
    "log",
    "exp",
    "abs",
  ];
  for (const fn of functions) {
    // \sin{x} or \sin(x) → sin(x)
    const re = new RegExp(`\\\\${fn}\\s*\\{([^{}]*)\\}`, "g");
    expr = expr.replace(re, `${fn}($1)`);
    // \sin x (space-separated single token)
    const reSpace = new RegExp(`\\\\${fn}\\b`, "g");
    expr = expr.replace(reSpace, fn);
  }

  // ── Greek letters that are common variable names ──
  const greekLetters: Record<string, string> = {
    "\\alpha": "alpha",
    "\\beta": "beta",
    "\\gamma": "gamma",
    "\\delta": "delta",
    "\\epsilon": "epsilon",
    "\\theta": "theta",
    "\\lambda": "lambda",
    "\\mu": "mu",
    "\\pi": "pi",
    "\\sigma": "sigma",
    "\\omega": "omega",
    "\\phi": "phi",
    "\\psi": "psi",
    "\\tau": "tau",
  };
  for (const [tex, name] of Object.entries(greekLetters)) {
    expr = expr.replaceAll(tex, name);
  }

  // ── Infinity ──
  expr = expr.replace(/\\infty/g, "Infinity");

  // ── Curly braces that are just LaTeX grouping → remove ──
  expr = expr.replace(/[{}]/g, "");

  // ── Strip stray backslashes from unrecognised commands ──
  expr = expr.replace(/\\[a-zA-Z]+/g, "");

  // ── Whitespace normalisation ──
  expr = expr.replace(/\s+/g, " ").trim();

  return expr;
}

/**
 * Convenience: clean + translate in one call.
 */
export function latexToMathjsFull(raw: string): string {
  return latexToMathjs(cleanLatex(raw));
}
