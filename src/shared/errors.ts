import { ERROR_CODES, AppError } from "../shared/types";

export class ExtensionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ExtensionError";
    this.code = code;
  }
}

export function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as AppError).code === "string"
  );
}

export function logError(err: unknown, context?: string): void {
  const prefix = context ? `[${context}] ` : "";
  console.error(`${prefix}Error:`, err);
}

export function createRestrictedPageError(detail: string): AppError {
  return {
    code: ERROR_CODES.RESTRICTED_PAGE,
    message: `Cannot capture on this page: ${detail}`,
  };
}

export function createQuotaError(detail: string): AppError {
  return {
    code: ERROR_CODES.QUOTA_EXCEEDED,
    message: `Storage quota exceeded: ${detail}`,
  };
}

export function createDBError(detail: string): AppError {
  return {
    code: ERROR_CODES.DB_ERROR,
    message: `Database error: ${detail}`,
  };
}

export function createCaptureError(detail: string): AppError {
  return {
    code: ERROR_CODES.CAPTURE_FAILED,
    message: `Capture failed: ${detail}`,
  };
}

export function createNotFoundError(entity: string): AppError {
  return {
    code: ERROR_CODES.NOT_FOUND,
    message: `${entity} not found`,
  };
}

export function createInvalidInputError(detail: string): AppError {
  return {
    code: ERROR_CODES.INVALID_INPUT,
    message: `Invalid input: ${detail}`,
  };
}
