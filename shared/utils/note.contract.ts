// shared/note.contract.ts
import { z } from "zod";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

// ── Note type discriminator ──
// "TEXT" = default rich-text note, "MATH" = handwritten math note, "CANVAS" = free-form drawing canvas
export const NoteTypeSchema = z.enum(["TEXT", "MATH", "CANVAS"]).default("TEXT");
export type NoteType = z.infer<typeof NoteTypeSchema>;

// ── Math-specific metadata stored alongside the note ──
export const MathNoteMetadataSchema = z.object({
  /** Ordered list of recognised strokes / lines */
  lines: z.array(
    z.object({
      /** Raw LaTeX returned by the OCR model */
      latex: z.string(),
      /** mathjs-compatible expression */
      expression: z.string(),
      /** Evaluation result (null if not evaluable) */
      result: z.string().nullable(),
      /** Canvas region where this expression was handwritten */
      boundingBox: z.object({
        minX: z.number(),
        minY: z.number(),
        maxX: z.number(),
        maxY: z.number(),
      }).optional(),
    })
  ).default([]),
  /** Persisted mathjs variable scope (e.g. { x: 5, y: 10 }) */
  scope: z.record(z.string(), z.unknown()).default({}),
  /** Raw ink strokes for MyScript recognition and persistent redraw */
  strokes: z.array(
    z.object({
      x: z.array(z.number()),
      y: z.array(z.number()),
      t: z.array(z.number()),
      id: z.number(),
    })
  ).default([]),
});
export type MathNoteMetadata = z.infer<typeof MathNoteMetadataSchema>;

// ── Canvas-specific metadata stored alongside the note ──
export const CanvasShapeSchema = z.object({
  id: z.string(),
  type: z.enum(["rect", "circle", "ellipse", "line", "text", "star", "arrow", "freedraw"]),
  x: z.number().default(0),
  y: z.number().default(0),
  rotation: z.number().default(0),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  opacity: z.number().default(1),
  // Shape-specific properties
  width: z.number().optional(),
  height: z.number().optional(),
  radius: z.number().optional(),
  radiusX: z.number().optional(),
  radiusY: z.number().optional(),
  points: z.array(z.number()).optional(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  numPoints: z.number().optional(),
  innerRadius: z.number().optional(),
  outerRadius: z.number().optional(),
  closed: z.boolean().optional(),
  tension: z.number().optional(),
  dash: z.array(z.number()).optional(),
  draggable: z.boolean().default(true),
});
export type CanvasShape = z.infer<typeof CanvasShapeSchema>;

export const CanvasNoteMetadataSchema = z.object({
  shapes: z.array(CanvasShapeSchema).default([]),
});
export type CanvasNoteMetadata = z.infer<typeof CanvasNoteMetadataSchema>;

export const NoteSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  order: z.number().int().default(0),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
  /** Discriminator — defaults to "TEXT" for backward compatibility */
  noteType: z.preprocess(
    (val) => (val === null ? undefined : val),
    NoteTypeSchema.optional()
  ),
  /** Arbitrary JSON metadata — used by MATH notes to store lines & scope */
  metadata: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.record(z.string(), z.unknown()).optional()
  ),
});
export type Note = z.infer<typeof NoteSchema>;

export const CreateNoteDTO = z.object({
  workspaceId: z.string(),
  content: z.preprocess(trim, z.string().min(0)),
  tags: z.array(z.string()).default([]),
  // Allow null/empty to be normalized
  noteType: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    NoteTypeSchema.optional()
  ),
  // Accept null and transform to undefined
  metadata: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.record(z.string(), z.unknown()).optional()
  ),
});
export type CreateNoteDTO = z.infer<typeof CreateNoteDTO>;

export const UpdateNoteDTO = z.object({
  content: z.preprocess(trim, z.string().min(0)).optional(),
  tags: z.array(z.string()).optional(),
  // Allow string to be sent (some clients may send the string value directly)
  // .transform ensures we normalize to valid enum values
  noteType: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    NoteTypeSchema.optional()
  ),
  // Accept null and transform to undefined for Zod validation
  metadata: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.record(z.string(), z.unknown()).optional()
  ),
});
export type UpdateNoteDTO = z.infer<typeof UpdateNoteDTO>;

export const ReorderNotesDTO = z.object({
  workspaceId: z.string(),
  noteOrders: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().min(0),
    })
  ),
});
export type ReorderNotesDTO = z.infer<typeof ReorderNotesDTO>;

