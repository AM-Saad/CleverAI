import { defineEventHandler, readBody } from "h3";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { createHmac } from "crypto";

/**
 * MyScript iInk Batch API proxy.
 *
 * Accepts stroke data from the client, signs the request with HMAC-SHA512,
 * and forwards it to MyScript Cloud for math recognition.
 *
 * IMPORTANT API behaviour (discovered via direct testing):
 *  - /batch with Accept: application/vnd.myscript.jiix → returns JIIX root
 *    object { type, expressions, label, id, version }. `label` IS the LaTeX.
 *  - /batch with Accept: application/x-latex → returns raw LaTeX text (not JSON).
 *  - /recognize with Accept: application/x-latex → returns raw LaTeX text.
 *  - $fetch auto-parses JSON but chokes on non-JSON (returns empty {}),
 *    so we use native fetch for the LaTeX call.
 *
 * Strategy: call /batch with Accept: application/vnd.myscript.jiix to get
 * the JIIX response, which contains `label` (the LaTeX) AND the parsed
 * expression tree with solver results — all in one request.
 */

interface InkStroke {
  x: number[];
  y: number[];
  t: number[];
  id: number;
}

interface MyScriptRequest {
  strokes: InkStroke[];
  width?: number;
  height?: number;
}

const MYSCRIPT_BATCH_URL =
  "https://cloud.myscript.com/api/v4.0/iink/batch";

export default defineEventHandler(async (event) => {
  // ── Auth ──
  await requireRole(event, ["USER"]);

  // ── Read body ──
  const body = await readBody<MyScriptRequest>(event);
  if (!body?.strokes?.length) {
    throw Errors.badRequest("No strokes provided");
  }

  // ── Runtime config ──
  const config = useRuntimeConfig();
  const applicationKey = config.myscriptApplicationKey as string | undefined;
  const hmacKey = config.myscriptHmacKey as string | undefined;

  if (!applicationKey || !hmacKey) {
    throw Errors.server(
      "MyScript API keys not configured. Set MYSCRIPT_APPLICATION_KEY and MYSCRIPT_HMAC_KEY in .env"
    );
  }

  // ── Build MyScript payload ──
  const myScriptStrokes = body.strokes.map((s) => ({
    id: `stroke-${s.id}`,
    pointerType: "mouse",
    x: s.x,
    y: s.y,
    t: s.t,
    p: s.x.map(() => 0.7),
  }));

  const width = body.width || 800;
  const height = body.height || 400;

  const payload = {
    configuration: {
      lang: "en_US",
      math: {
        solver: {
          enable: true,
          "fractional-part-digits": 3,
          "decimal-separator": ".",
          "rounding-mode": "half up",
          "angle-unit": "deg",
        },
        margin: { top: 20, left: 10, right: 10, bottom: 10 },
        eraser: { "erase-precisely": false },
        "undo-redo": { mode: "stroke" },
        mimeTypes: ["application/x-latex"],
      },
      export: {
        "image-resolution": 300,
        jiix: {
          "bounding-box": true,
          strokes: false,
          text: { chars: false, words: true },
        },
      },
    },
    xDPI: 96,
    yDPI: 96,
    contentType: "Math",
    width,
    height,
    strokeGroups: [
      {
        penStyle:
          "color: #000000;\nwidth: 1.8897637795275593;\n-myscript-pen-width: 1;\n-myscript-pen-fill-style: none;\n-myscript-pen-fill-color: #FFFFFF00;",
        strokes: myScriptStrokes,
      },
    ],
  };

  const payloadString = JSON.stringify(payload);

  // ── HMAC-SHA512 signing ──
  const hmacSecret = applicationKey + hmacKey;
  const hmac = createHmac("sha512", hmacSecret)
    .update(payloadString)
    .digest("hex");

  console.log("[myscript.post] Sending request to MyScript Cloud", {
    strokeCount: body.strokes.length,
    payloadSize: payloadString.length,
    canvasSize: `${width}x${height}`,
  });

  try {
    // Use native fetch (not $fetch) because MyScript returns non-JSON
    // content types that $fetch auto-parses incorrectly.
    const res = await fetch(MYSCRIPT_BATCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Request JIIX which contains label (LaTeX) + expression tree + solver
        Accept: "application/vnd.myscript.jiix",
        applicationKey,
        hmac,
      },
      body: payloadString,
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[myscript.post] MyScript API error:", res.status, errBody);
      throw Errors.server(
        `MyScript recognition failed (${res.status}): ${errBody}`
      );
    }

    const responseText = await res.text();
    console.log("[myscript.post] Raw MyScript response:", responseText.slice(0, 500));

    // Parse the JIIX response
    const jiix = JSON.parse(responseText);

    // JIIX root structure: { type: "Math", expressions: [...], label: "1+1", id, version }
    // `label` is the LaTeX expression string
    const latex = jiix.label ?? "";

    // Extract solver result from expression tree
    let solverResult: string | null = null;
    if (jiix.expressions) {
      for (const expr of jiix.expressions) {
        // Check for solved result
        if (expr?.result?.label) {
          solverResult = expr.result.label;
        }
        // Check operands for number types
        if (expr?.operands) {
          for (const op of expr.operands) {
            if (op?.type === "number" && op?.label) {
              // Only use as solver result if it's a computed result, not an input
              if (op.computed) {
                solverResult = op.label;
              }
            }
          }
        }
      }
    }

    // Extract bounding box if available
    let boundingBox: {
      minX: number; minY: number; maxX: number; maxY: number;
    } | null = null;

    const bb = jiix["bounding-box"] || jiix.boundingBox;
    if (bb) {
      boundingBox = {
        minX: bb.x ?? bb.left ?? 0,
        minY: bb.y ?? bb.top ?? 0,
        maxX: (bb.x ?? bb.left ?? 0) + (bb.width ?? 0),
        maxY: (bb.y ?? bb.top ?? 0) + (bb.height ?? 0),
      };
    }

    console.log("[myscript.post] Extracted:", {
      latex,
      solverResult,
      hasBoundingBox: !!boundingBox,
      expressionCount: jiix.expressions?.length ?? 0,
    });

    return success({
      latex,
      jiix,
      solverResult,
      boundingBox,
    });
  } catch (err: any) {
    // Don't re-wrap our own Errors
    if (err?.statusCode) throw err;
    console.error("[myscript.post] MyScript API error:", err?.message || err);
    throw Errors.server(
      `MyScript recognition failed: ${err?.message || "Unknown error"}`
    );
  }
});
