import { latexToMathjsFull } from "~/utils/math/latexToMathjs";

type Rect = { minX: number; minY: number; maxX: number; maxY: number };
type Stroke = { x: number[]; y: number[]; t: number[]; id: number };

export function useMathRecognition() {
  const isRecognizing = ref(false);
  const currentLatex = ref<string | null>(null);
  const currentResult = ref<string | null>(null);
  const recognitionError = ref<Error | null>(null);
  let parser: {
    evaluate: (expression: string) => unknown;
    getAll: () => Record<string, unknown>;
  } | null = null;

  async function getParser() {
    if (parser) return parser;
    const { create, all } = await import("mathjs");
    parser = create(all!).parser();
    return parser;
  }

  async function getScope() {
    return { ...(await getParser()).getAll() };
  }

  async function restoreScope(saved: Record<string, unknown>) {
    const mathParser = await getParser();
    for (const [key, value] of Object.entries(saved)) {
      try {
        mathParser.evaluate(`${key} = ${JSON.stringify(value)}`);
      } catch {
        // Ignore values that cannot be restored as assignments.
      }
    }
  }

  function strokesToDataUrl(
    strokes: Stroke[],
    size: { width: number; height: number },
  ) {
    const padding = 20;
    const sourceWidth = Math.max(size.width, 1);
    const sourceHeight = Math.max(size.height, 1);
    const scale = Math.min(1, 2_048 / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(100, Math.ceil(sourceWidth * scale + padding * 2));
    canvas.height = Math.max(
      100,
      Math.ceil(sourceHeight * scale + padding * 2),
    );
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(padding, padding);
    context.scale(scale, scale);
    context.lineWidth = 3 / scale;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "black";
    for (const stroke of strokes) {
      if (stroke.x.length < 2) continue;
      context.beginPath();
      context.moveTo(stroke.x[0]!, stroke.y[0]!);
      for (let index = 1; index < stroke.x.length; index += 1) {
        context.lineTo(stroke.x[index]!, stroke.y[index]!);
      }
      context.stroke();
    }
    return canvas.toDataURL("image/png");
  }

  async function recognizeWithOpenRouter(
    strokes: Stroke[],
    rect?: Rect,
    canvasSize = { width: 500, height: 300 },
  ) {
    if (!strokes.length) throw new Error("No strokes provided");
    isRecognizing.value = true;
    recognitionError.value = null;
    try {
      const response = await $fetch<{ data: { latex: string } }>(
        "/api/ai/math-recognize",
        {
          method: "POST",
          body: { imageDataUrl: strokesToDataUrl(strokes, canvasSize) },
        },
      );
      const latex = response.data.latex
        .replace(/\\\[\\\[|\\\]\\\]|\\\[|\\\]|\\\(|\\\)/g, "")
        .replace(/\\right\s*[.|)\]]/g, "")
        .replace(/\\left\s*[.|([]/g, "")
        .replace(/\\right|\\left/g, "")
        .trim();
      const expression = latexToMathjsFull(latex);
      let result: string | null = null;
      try {
        const value = (await getParser()).evaluate(expression);
        result = value == null ? null : String(value);
      } catch {
        result = null;
      }
      currentLatex.value = latex;
      currentResult.value = result;
      return { latex, expression, result, boundingBox: rect };
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      recognitionError.value = error;
      throw error;
    } finally {
      isRecognizing.value = false;
    }
  }

  return {
    recognizeWithOpenRouter,
    getScope,
    restoreScope,
    currentLatex: readonly(currentLatex),
    currentResult: readonly(currentResult),
    isRecognizing: readonly(isRecognizing),
    recognitionError: readonly(recognitionError),
  };
}
