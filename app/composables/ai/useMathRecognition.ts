import { latexToMathjsFull } from "~/utils/math/latexToMathjs";

/**
 * Composable for handwritten-math recognition via MyScript REST API.
 *
 * ARCHITECTURE:
 *  - Component layer: owns the canvas / ink capture (MathNoteEditor.vue).
 *  - This composable: sends strokes to MyScript via server proxy, translates
 *    LaTeX→mathjs, and manages variable scope persistence across lines.
 *  - Server layer: HMAC signs and proxies to MyScript Cloud (myscript.post.ts).
 *
 * @example
 * ```ts
 * const { recognizeWithMyScript, getScope } = useMathRecognition();
 * const outcome = await recognizeWithMyScript(strokes, boundingBox);
 * console.log(outcome.latex, outcome.result);
 * ```
 */
export function useMathRecognition() {
  /** Bounding box describing a sub-region of the canvas. */
  type Rect = { minX: number; minY: number; maxX: number; maxY: number };

  /** A single ink stroke with coordinate arrays. */
  type Stroke = { x: number[]; y: number[]; t: number[]; id: number };

  // ── Reactive state ──
  const isRecognizing = ref(false);
  const currentLatex = ref<string | null>(null);
  const currentResult = ref<string | null>(null);
  const recognitionError = ref<Error | null>(null);

  // ── Math scope (persists across strokes) ──
  // Lazily initialised to avoid importing mathjs at module level.
  let _parser: { evaluate: (expr: string) => any; getAll: () => Record<string, unknown> } | null = null;

  /** Lazily initialise the mathjs parser. */
  async function getParser() {
    if (_parser) return _parser;
    const { create, all } = await import("mathjs");
    const math = create(all!);
    _parser = math.parser();
    return _parser;
  }

  /**
   * Return the current variable scope (serialisable snapshot).
   * Useful for persisting in note metadata.
   */
  async function getScope(): Promise<Record<string, unknown>> {
    const parser = await getParser();
    return { ...parser.getAll() };
  }

  /**
   * Restore a previously saved scope (e.g. when reopening a note).
   */
  async function restoreScope(saved: Record<string, unknown>): Promise<void> {
    const parser = await getParser();
    for (const [key, value] of Object.entries(saved)) {
      try {
        parser.evaluate(`${key} = ${JSON.stringify(value)}`);
      } catch {
        // skip non-assignable values
      }
    }
  }

  /**
   * Recognise handwritten math from stroke data via the MyScript API proxy.
   *
   * @param strokes - Array of ink strokes captured from the canvas
   * @param rect - Optional bounding box for overlay positioning
   * @param canvasSize - Canvas dimensions in CSS pixels (for DPI mapping)
   * @returns Object with `latex`, `expression`, `result`, and `boundingBox`.
   */
  async function recognizeWithMyScript(
    strokes: Stroke[],
    rect?: Rect,
    canvasSize?: { width: number; height: number }
  ): Promise<{
    latex: string;
    expression: string;
    result: string | null;
    boundingBox?: Rect;
  }> {
    console.log("[useMathRecognition] recognizeWithMyScript called with", strokes.length, "strokes");

    if (!strokes.length) {
      throw new Error("No strokes provided");
    }

    // Reset state
    currentLatex.value = null;
    currentResult.value = null;
    recognitionError.value = null;
    isRecognizing.value = true;

    try {
      // ── Step 1: Call server proxy ──
      const response = await $fetch<{
        data: {
          latex: string;
          jiix: any;
          solverResult: string | null;
          boundingBox: Rect | null;
        };
      }>("/api/ai/myscript", {
        method: "POST",
        body: {
          strokes,
          width: canvasSize?.width,
          height: canvasSize?.height,
        },
      });

      const rawLatex = response.data.latex;
      console.log("🔍 [useMathRecognition] MyScript raw LaTeX:", rawLatex);

      // ── Step 2: Clean LaTeX ──
      const cleanedLatex = rawLatex
        .replace(/\\\[\\\[|\\\]\\\]|\\\[|\\\]|\\\(|\\\)/g, '')
        .replace(/\\right\s*[.|)\]]/g, '')
        .replace(/\\left\s*[.|([]/g, '')
        .replace(/\\right/g, '')
        .replace(/\\left/g, '')
        .trim();

      currentLatex.value = cleanedLatex;

      // ── Step 3: Convert LaTeX → mathjs ──
      const expression = latexToMathjsFull(cleanedLatex);

      console.log("📐 [useMathRecognition] MyScript LaTeX → mathjs:", {
        rawLatex,
        cleanedLatex,
        expression,
        serverSolverResult: response.data.solverResult,
      });

      // ── Step 4: Evaluate with mathjs ──
      let evalResult: string | null = null;
      try {
        const parser = await getParser();
        const raw = parser.evaluate(expression);
        evalResult = raw != null ? String(raw) : null;
      } catch {
        // Fall back to server solver result if mathjs can't parse
        evalResult = response.data.solverResult ?? null;
      }

      // If mathjs gave nothing, use MyScript's solver result
      if (evalResult === null && response.data.solverResult) {
        evalResult = response.data.solverResult;
      }

      currentResult.value = evalResult;

      // Use bounding box from JIIX if available, otherwise fallback to provided rect
      const resultBox = response.data.boundingBox ?? rect;

      return {
        latex: cleanedLatex,
        expression,
        result: evalResult,
        boundingBox: resultBox ?? undefined,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      recognitionError.value = error;
      throw error;
    } finally {
      isRecognizing.value = false;
    }
  }

  return {
    // Actions
    recognizeWithMyScript,
    getScope,
    restoreScope,

    // Reactive state
    currentLatex: readonly(currentLatex),
    currentResult: readonly(currentResult),
    isRecognizing: readonly(isRecognizing),
    recognitionError: readonly(recognitionError),
  };
}
