import type { ApiErrorBody } from "@/types/api";

/** Error thrown for any non-2xx API response. `code` is the backend's stable error code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.body = body;
  }

  /** Field errors from VALIDATION_FAILED, keyed by field path. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.body.errors ?? []).map((e) => [e.field, e.message]));
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  /** false = a 401 just throws (public pages); default true = refresh, then send to /login. */
  requireAuth?: boolean;
}

const SESSION_CODES = new Set(["UNAUTHENTICATED", "SESSION_EXPIRED"]);

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by all requests that got a 401. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return `/api${path}${qs ? `?${qs}` : ""}`;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    body = { statusCode: res.status, code: "NETWORK_ERROR", message: res.statusText };
  }
  if (!body.code) body.code = `HTTP_${res.status}`;
  return new ApiError(res.status, body);
}

function goToLogin(reason?: string) {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  const params = new URLSearchParams({ next });
  if (reason) params.set("reason", reason);
  window.location.assign(`/login?${params.toString()}`);
}

/** Browser-side API call through the /api proxy (cookies are sent automatically). */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, query, requireAuth = true } = options;
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  const url = buildUrl(path, query);

  const isAuthCall = path.startsWith("/auth/");
  let res = await fetch(url, init);
  // Access token expired: refresh once and retry.
  if (res.status === 401 && !isAuthCall) {
    const err = await parseError(res.clone());
    if (SESSION_CODES.has(err.code) && (await refreshSession())) {
      res = await fetch(url, init);
    }
  }
  if (!res.ok) {
    const err = await parseError(res);
    const loggedOut = res.status === 401 && !isAuthCall && requireAuth;
    if (loggedOut || err.code === "ACCOUNT_BANNED") goToLogin(err.code);
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Uploads a file straight to R2 with a presigned URL from the API. */
export async function putToStorage(
  ticket: { uploadUrl: string; headers: Record<string, string> },
  file: File,
): Promise<void> {
  const res = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: ticket.headers,
    body: file,
  });
  if (!res.ok) {
    throw new ApiError(res.status, {
      statusCode: res.status,
      code: "UPLOAD_FAILED",
      message: "The file could not be uploaded. Please try again.",
    });
  }
}
