export type CaptureType = "text" | "code" | "link" | "question" | "note" | "screenshot";

export interface SourceInfo {
  url: string | null;
  title: string | null;
  domain: string | null;
  favicon_data: string | null;
}

export interface ContentPayload {
  text: string | null;
  code_language: string | null;
  anchor: { prefix: string; suffix: string } | null;
  question_state: "open" | "answered" | null;
}

export interface AttachmentRef {
  attachment_id: string;
  role: string;
  position: number;
}

export interface Capture {
  capture_id: string;
  type: CaptureType;
  context_id: string;
  created_at: string;
  updated_at: string;
  source_url: string | null;
  source_title: string | null;
  source_domain: string | null;
  favicon_data: string | null;
  content_text: string | null;
  code_language: string | null;
  user_note: string | null;
  anchor: { prefix: string; suffix: string } | null;
  question_state: "open" | "answered" | null;
  incognito: boolean;
  deleted_at: string | null;
  version: number;
  owner_id: string | null;
  search_text: string | null;
}

export interface ContextRecord {
  context_id: string;
  title: string;
  status: "active" | "archived";
  created_at: string;
  last_active_at: string;
  first_url: string | null;
  last_url: string | null;
  deleted_at: string | null;
  version: number;
  owner_id: string | null;
}

export interface AttachmentRecord {
  attachment_id: string;
  sha256: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  blob: Blob;
  thumb: Blob | null;
  created_at: string;
}

export interface CaptureAttachmentJoin {
  capture_id: string;
  attachment_id: string;
  role: string;
  position: number;
}

export interface TagRecord {
  tag_id: string;
  name: string;
  display_name: string;
}

export interface CaptureTagJoin {
  capture_id: string;
  tag_id: string;
  added_at: string;
}

export interface ChangeJournalEntry {
  seq: number;
  entity_type: string;
  entity_id: string;
  op: "create" | "update" | "delete";
  changed_fields: string[] | null;
  at: string;
  device_id: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface MetaRecord {
  key: string;
  schema_version: number;
  device_id: string;
  install_id_local: string;
}

export interface TabBinding {
  context_id: string;
  window_id: number;
  bound_at: number;
}

export interface NewCaptureInput {
  type: CaptureType;
  context_id: string;
  source?: SourceInfo;
  content?: ContentPayload;
  user_note?: string | null;
  tags?: string[];
  attachments?: AttachmentRef[];
  incognito?: boolean;
  search_text?: string | null;
}

export interface SearchResult {
  capture_id: string;
  score: number;
  snippet: string | null;
}

export interface SearchFilters {
  type?: CaptureType[];
  domain?: string[];
  context?: string[];
  tag?: string[];
  date_from?: string;
  date_to?: string;
  query?: string;
}

export type AppError =
  | { code: "RESTRICTED_PAGE"; message: string }
  | { code: "QUOTA_EXCEEDED"; message: string }
  | { code: "DB_ERROR"; message: string }
  | { code: "CAPTURE_FAILED"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "INVALID_INPUT"; message: string };

export const ERROR_CODES = {
  RESTRICTED_PAGE: "RESTRICTED_PAGE",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  DB_ERROR: "DB_ERROR",
  CAPTURE_FAILED: "CAPTURE_FAILED",
  NOT_FOUND: "NOT_FOUND",
  INVALID_INPUT: "INVALID_INPUT",
} as const;

export function generateId(): string {
  return crypto.randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function nowMs(): number {
  return Date.now();
}

export function stripDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normaliseSearchText(
  fields: (string | null | undefined)[]
): string {
  return fields
    .filter((f): f is string => typeof f === "string" && f.length > 0)
    .join(" ")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.protocol.startsWith("http")) return null;
    return u.hostname;
  } catch {
    return null;
  }
}

export function sanitiseFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}
