// shared/boardItem.contract.ts
import { z } from "zod";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

// ─── Attachment ──────────────────────────────────────────────────────────────

export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url("Attachment URL must be valid"),
  type: z.string().default("link"), // 'link' | 'image' | 'pdf' etc.
  size: z.number().int().optional(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

// ─── Board Item ───────────────────────────────────────────────────────────────

export const BoardItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  columnId: z.string().nullable().optional(),
  workspaceId: z.string().nullable().optional(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  order: z.number().int().default(0),
  dueDate: z.string().datetime().or(z.date()).nullable().optional(),
  attachments: z.array(AttachmentSchema).default([]),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type BoardItem = z.infer<typeof BoardItemSchema>;

export const CreateBoardItemDTO = z.object({
  content: z.preprocess(trim, z.string().min(0)),
  tags: z.array(z.string()).default([]),
  columnId: z.string().optional(),
  workspaceId: z.string().nullable().optional(),
  dueDate: z.string().datetime().or(z.date()).nullable().optional(),
  attachments: z.array(AttachmentSchema).default([]),
});
export type CreateBoardItemDTO = z.infer<typeof CreateBoardItemDTO>;

export const UpdateBoardItemDTO = z.object({
  content: z.preprocess(trim, z.string().min(0)).optional(),
  tags: z.array(z.string()).optional(),
  dueDate: z.string().datetime().or(z.date()).nullable().optional(),
  attachments: z.array(AttachmentSchema).optional(),
});
export type UpdateBoardItemDTO = z.infer<typeof UpdateBoardItemDTO>;

export const ReorderBoardItemsDTO = z.object({
  itemOrders: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().min(0),
    })
  ),
});
export type ReorderBoardItemsDTO = z.infer<typeof ReorderBoardItemsDTO>;

// ─── Item Link ───────────────────────────────────────────────────────────────

export const LINK_TYPES = ["PARENT", "CHILD", "RELATED", "BLOCKS", "BLOCKED_BY", "DUPLICATE"] as const;
export type LinkType = typeof LINK_TYPES[number];

export const BoardItemLinkSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  linkType: z.enum(LINK_TYPES),
  userId: z.string(),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  // populated when fetched
  target: BoardItemSchema.pick({ id: true, content: true, columnId: true, tags: true, dueDate: true }).optional(),
  source: BoardItemSchema.pick({ id: true, content: true, columnId: true, tags: true, dueDate: true }).optional(),
});
export type BoardItemLink = z.infer<typeof BoardItemLinkSchema>;

export const CreateBoardItemLinkDTO = z.object({
  sourceId: z.string(),
  targetId: z.string(),
  linkType: z.enum(LINK_TYPES).default("RELATED"),
});
export type CreateBoardItemLinkDTO = z.infer<typeof CreateBoardItemLinkDTO>;

// ─── Item Comment ─────────────────────────────────────────────────────────────

export const BoardItemCommentSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  userId: z.string(),
  content: z.preprocess(trim, z.string().min(1)),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
  author: z.object({
    name: z.string().nullable().optional(),
    email: z.string().optional(),
  }).optional(),
});
export type BoardItemComment = z.infer<typeof BoardItemCommentSchema>;

export const CreateBoardItemCommentDTO = z.object({
  itemId: z.string(),
  content: z.preprocess(trim, z.string().min(1, "Comment cannot be empty")),
});
export type CreateBoardItemCommentDTO = z.infer<typeof CreateBoardItemCommentDTO>;
