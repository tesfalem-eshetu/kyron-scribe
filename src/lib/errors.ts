import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ACCOUNT_INACTIVE"
  | "NOT_FOUND"
  | "INSUFFICIENT_CLINICAL_CONTENT"
  | "TEMPLATE_UNAVAILABLE"
  | "DRAFT_FINALIZED"
  | "VERSION_CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  ACCOUNT_INACTIVE: 403,
  NOT_FOUND: 404,
  INSUFFICIENT_CLINICAL_CONTENT: 422,
  TEMPLATE_UNAVAILABLE: 409,
  DRAFT_FINALIZED: 409,
  VERSION_CONFLICT: 409,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export const unauthorized = (message = "Authentication required.") =>
  new ApiError("UNAUTHORIZED", message);

export const forbidden = (message = "You do not have access to this resource.") =>
  new ApiError("FORBIDDEN", message);

export const accountInactive = (message = "This account is inactive.") =>
  new ApiError("ACCOUNT_INACTIVE", message);

export const notFound = (message = "Resource not found.") =>
  new ApiError("NOT_FOUND", message);

export const validationError = (message = "The request was invalid.") =>
  new ApiError("VALIDATION_ERROR", message);

export const insufficientClinicalContent = (
  message = "The provided input does not contain enough clinically meaningful information.",
) => new ApiError("INSUFFICIENT_CLINICAL_CONTENT", message);

export const templateUnavailable = (
  message = "The selected template is unavailable.",
) => new ApiError("TEMPLATE_UNAVAILABLE", message);

export const versionConflict = (
  message = "This note has been updated since you loaded it.",
) => new ApiError("VERSION_CONFLICT", message);

export const draftFinalized = (
  message = "This encounter is finalized and can no longer be autosaved.",
) => new ApiError("DRAFT_FINALIZED", message);

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    { status: 500 },
  );
}
