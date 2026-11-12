import { z } from "zod";

export const CaptureTypeSchema = z.enum([
  "text",
  "code",
  "link",
  "question",
  "note",
  "screenshot",
]);

export const ContextStatusSchema = z.enum(["active", "archived"]);

export const CaptureSchema = z.object({
  capture_id: z.string().uuid(),
  type: CaptureTypeSchema,
  context_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  source_url: z.string().url().nullable(),
  source_title: z.string().nullable(),
  source_domain: z.string().nullable(),
  favicon_data: z.string().nullable(),
  content_text: z.string().nullable(),
  code_language: z.string().nullable(),
  user_note: z.string().nullable(),
  anchor: z
    .object({ prefix: z.string(), suffix: z.string() })
    .nullable(),
  question_state: z.enum(["open", "answered"]).nullable(),
  incognito: z.boolean(),
  deleted_at: z.string().datetime().nullable(),
  version: z.number().int().nonnegative(),
  owner_id: z.string().nullable(),
  search_text: z.string().nullable(),
});

export const ContextSchema = z.object({
  context_id: z.string().uuid(),
  title: z.string().min(1),
  status: ContextStatusSchema,
  created_at: z.string().datetime(),
  last_active_at: z.string().datetime(),
  first_url: z.string().url().nullable(),
  last_url: z.string().url().nullable(),
  deleted_at: z.string().datetime().nullable(),
  version: z.number().int().nonnegative(),
  owner_id: z.string().nullable(),
});

export const AttachmentSchema = z.object({
  attachment_id: z.string().uuid(),
  sha256: z.string().length(64),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(),
  created_at: z.string().datetime(),
});

export const TagSchema = z.object({
  tag_id: z.string().uuid(),
  name: z.string().min(1).max(50),
  display_name: z.string().min(1).max(50),
});

export const ChangeJournalSchema = z.object({
  seq: z.number().int().nonnegative(),
  entity_type: z.string(),
  entity_id: z.string(),
  op: z.enum(["create", "update", "delete"]),
  changed_fields: z.array(z.string()).nullable(),
  at: z.string().datetime(),
  device_id: z.string(),
});

export type CaptureInput = z.infer<typeof CaptureSchema>;
export type ContextInput = z.infer<typeof ContextSchema>;

export const MAX_SELECTION_CHARS = 100_000;
export const SCHEMA_VERSION = 1;
