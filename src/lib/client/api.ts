// Typed fetch wrapper for client components. Surfaces the canonical API error
// codes (see src/lib/errors.ts) so screens can branch on them.

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ACCOUNT_INACTIVE"
  | "NOT_FOUND"
  | "INSUFFICIENT_CLINICAL_CONTENT"
  | "TEMPLATE_UNAVAILABLE"
  | "DRAFT_FINALIZED"
  | "VERSION_CONFLICT"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR";

export class ClientApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: "same-origin",
    });
  } catch {
    throw new ClientApiError(
      "NETWORK_ERROR",
      "Unable to reach the server. Check your connection and try again.",
      0,
    );
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const body = (payload ?? {}) as { error?: string; message?: string };
    const code = (body.error as ApiErrorCode) ?? "INTERNAL_ERROR";
    const message = body.message ?? "Something went wrong. Please try again.";
    throw new ClientApiError(code, message, res.status);
  }

  return payload as T;
}

export function isApiError(error: unknown): error is ClientApiError {
  return error instanceof ClientApiError;
}
