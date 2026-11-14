export const MESSAGE_TYPES = {
  CAPTURE_TEXT: "CAPTURE_TEXT",
  CAPTURE_NOTE: "CAPTURE_NOTE",
  CAPTURE_QUESTION: "CAPTURE_QUESTION",
  CAPTURE_LINK: "CAPTURE_LINK",
  CAPTURE_CODE: "CAPTURE_CODE",
  CAPTURE_SCREENSHOT: "CAPTURE_SCREENSHOT",
  GET_CONTEXT_FOR_TAB: "GET_CONTEXT_FOR_TAB",
  LIST_CONTEXTS: "LIST_CONTEXTS",
  LIST_CAPTURES: "LIST_CAPTURES",
  GET_CAPTURE: "GET_CAPTURE",
  SEARCH_CAPTURES: "SEARCH_CAPTURES",
  UPDATE_CAPTURE: "UPDATE_CAPTURE",
  DELETE_CAPTURE: "DELETE_CAPTURE",
  UNDO_DELETE: "UNDO_DELETE",
  CREATE_CONTEXT: "CREATE_CONTEXT",
  UPDATE_CONTEXT: "UPDATE_CONTEXT",
  ARCHIVE_CONTEXT: "ARCHIVE_CONTEXT",
  DELETE_CONTEXT: "DELETE_CONTEXT",
  REBIND_CONTEXT: "REBIND_CONTEXT",
  MERGE_CONTEXTS: "MERGE_CONTEXTS",
  ADD_TAG: "ADD_TAG",
  REMOVE_TAG: "REMOVE_TAG",
  GET_SETTINGS: "GET_SETTINGS",
  SET_SETTING: "SET_SETTING",
  EXPORT_MARKDOWN: "EXPORT_MARKDOWN",
  EXPORT_PDF: "EXPORT_PDF",
  EXPORT_BACKUP: "EXPORT_BACKUP",
  IMPORT_BACKUP: "IMPORT_BACKUP",
  GET_STORAGE_INFO: "GET_STORAGE_INFO",
  OPEN_PANEL: "OPEN_PANEL",
  RECONCILE_BINDINGS: "RECONCILE_BINDINGS",
  LIST_HIGHLIGHTS: "LIST_HIGHLIGHTS",
  UPDATE_HIGHLIGHT_COLOR: "UPDATE_HIGHLIGHT_COLOR",
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: number;
}

export interface CaptureTextMessage extends BaseMessage {
  type: "CAPTURE_TEXT";
  payload: {
    text: string;
    tabId: number;
    windowId: number;
    note?: string;
    tags?: string[];
    anchor?: { prefix: string; suffix: string };
    highlightColor?: string;
  };
}

export interface ListHighlightsMessage extends BaseMessage {
  type: "LIST_HIGHLIGHTS";
  payload: { sourceUrl: string };
}

export interface UpdateHighlightColorMessage extends BaseMessage {
  type: "UPDATE_HIGHLIGHT_COLOR";
  payload: { capture_id: string; color: string };
}

export interface CaptureNoteMessage extends BaseMessage {
  type: "CAPTURE_NOTE";
  payload: {
    text: string;
    tabId: number | null;
    windowId: number | null;
    note?: string;
    tags?: string[];
  };
}

export interface CaptureQuestionMessage extends BaseMessage {
  type: "CAPTURE_QUESTION";
  payload: {
    text: string;
    tabId: number | null;
    windowId: number | null;
  };
}

export interface CaptureLinkMessage extends BaseMessage {
  type: "CAPTURE_LINK";
  payload: {
    url: string;
    title?: string;
    tabId: number | null;
    windowId: number | null;
    note?: string;
    tags?: string[];
  };
}

export interface CaptureCodeMessage extends BaseMessage {
  type: "CAPTURE_CODE";
  payload: {
    text: string;
    language?: string;
    tabId: number;
    windowId: number;
    note?: string;
    tags?: string[];
  };
}

export interface CaptureScreenshotMessage extends BaseMessage {
  type: "CAPTURE_SCREENSHOT";
  payload: {
    tabId: number;
    windowId: number;
    note?: string;
    tags?: string[];
  };
}

export interface GetContextForTabMessage extends BaseMessage {
  type: "GET_CONTEXT_FOR_TAB";
  payload: { tabId: number };
}

export interface ListContextsMessage extends BaseMessage {
  type: "LIST_CONTEXTS";
  payload: { status?: "active" | "archived" };
}

export interface ListCapturesMessage extends BaseMessage {
  type: "LIST_CAPTURES";
  payload: {
    context_id?: string;
    filters?: any;
    limit?: number;
    offset?: number;
  };
}

export interface SearchCapturesMessage extends BaseMessage {
  type: "SEARCH_CAPTURES";
  payload: {
    query: string;
    filters?: any;
    limit?: number;
  };
}

export interface UpdateCaptureMessage extends BaseMessage {
  type: "UPDATE_CAPTURE";
  payload: {
    capture_id: string;
    updates: Partial<{
      user_note: string;
      tags: string[];
      title: string;
    }>;
  };
}

export interface DeleteCaptureMessage extends BaseMessage {
  type: "DELETE_CAPTURE";
  payload: { capture_id: string };
}

export interface UndoDeleteMessage extends BaseMessage {
  type: "UNDO_DELETE";
  payload: { capture_id: string };
}

export interface CreateContextMessage extends BaseMessage {
  type: "CREATE_CONTEXT";
  payload: { title?: string };
}

export interface UpdateContextMessage extends BaseMessage {
  type: "UPDATE_CONTEXT";
  payload: { context_id: string; title: string };
}

export interface ArchiveContextMessage extends BaseMessage {
  type: "ARCHIVE_CONTEXT";
  payload: { context_id: string };
}

export interface DeleteContextMessage extends BaseMessage {
  type: "DELETE_CONTEXT";
  payload: { context_id: string };
}

export interface RebindContextMessage extends BaseMessage {
  type: "REBIND_CONTEXT";
  payload: { context_id: string; tabId: number; windowId: number };
}

export interface MergeContextsMessage extends BaseMessage {
  type: "MERGE_CONTEXTS";
  payload: { source_context_id: string; target_context_id: string };
}

export interface AddTagMessage extends BaseMessage {
  type: "ADD_TAG";
  payload: { capture_id: string; tag: string };
}

export interface RemoveTagMessage extends BaseMessage {
  type: "REMOVE_TAG";
  payload: { capture_id: string; tag_id: string };
}

export interface GetSettingsMessage extends BaseMessage {
  type: "GET_SETTINGS";
  payload: null;
}

export interface SetSettingMessage extends BaseMessage {
  type: "SET_SETTING";
  payload: { key: string; value: string };
}

export interface ExportMarkdownMessage extends BaseMessage {
  type: "EXPORT_MARKDOWN";
  payload: {
    scope: "capture" | "context" | "selection" | "all";
    ids: string[];
  };
}

export interface ExportPDFMessage extends BaseMessage {
  type: "EXPORT_PDF";
  payload: {
    scope: "capture" | "context" | "selection";
    ids: string[];
  };
}

export interface ExportBackupMessage extends BaseMessage {
  type: "EXPORT_BACKUP";
  payload: null;
}

export interface ImportBackupMessage extends BaseMessage {
  type: "IMPORT_BACKUP";
  payload: { file: File };
}

export interface GetStorageInfoMessage extends BaseMessage {
  type: "GET_STORAGE_INFO";
  payload: null;
}

export interface OpenPanelMessage extends BaseMessage {
  type: "OPEN_PANEL";
  payload?: {
    targetTab?: "thistab" | "all" | "contexts" | "projects" | "assistant" | "settings";
    prefillQuery?: string;
  } | null;
}

export interface ReconcileBindingsMessage extends BaseMessage {
  type: "RECONCILE_BINDINGS";
  payload: null;
}

export type ExtensionMessage =
  | CaptureTextMessage
  | CaptureNoteMessage
  | CaptureQuestionMessage
  | CaptureLinkMessage
  | CaptureCodeMessage
  | CaptureScreenshotMessage
  | GetContextForTabMessage
  | ListContextsMessage
  | ListCapturesMessage
  | SearchCapturesMessage
  | UpdateCaptureMessage
  | DeleteCaptureMessage
  | UndoDeleteMessage
  | CreateContextMessage
  | UpdateContextMessage
  | ArchiveContextMessage
  | DeleteContextMessage
  | RebindContextMessage
  | MergeContextsMessage
  | AddTagMessage
  | RemoveTagMessage
  | GetSettingsMessage
  | SetSettingMessage
  | ExportMarkdownMessage
  | ExportPDFMessage
  | ExportBackupMessage
  | ImportBackupMessage
  | GetStorageInfoMessage
  | OpenPanelMessage
  | ReconcileBindingsMessage
  | ListHighlightsMessage
  | UpdateHighlightColorMessage;

interface BaseResponse {
  id: string;
  success: boolean;
  error?: { code: string; message: string };
}

export interface SuccessResponse<T = unknown> extends BaseResponse {
  success: true;
  data: T;
}

export interface ErrorResponse extends BaseResponse {
  success: false;
  error: { code: string; message: string };
}

export type ExtensionResponse<T = unknown> =
  | SuccessResponse<T>
  | ErrorResponse;

export function createMessage<T extends ExtensionMessage["payload"]>(
  type: MessageType,
  payload: T
): ExtensionMessage {
  return {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
  } as ExtensionMessage;
}

export function createResponse<T>(
  id: string,
  data: T
): SuccessResponse<T> {
  return { id, success: true, data };
}

export function createErrorResponse(
  id: string,
  code: string,
  message: string
): ErrorResponse {
  return { id, success: false, error: { code, message } };
}
