import { sessionStore, type Scope, type Session } from "./session";

const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  scope?: Scope;
  auth?: boolean;
  retryOn401?: boolean;
  signal?: AbortSignal;
}

let authExpiredHandler: (() => void) | null = null;

export function onAuthExpired(handler: (() => void) | null): void {
  authExpiredHandler = handler;
}

async function parseError(response: Response): Promise<ApiError> {
  let code = "request_failed";
  let message = `Request failed with status ${response.status}`;
  let details: unknown;
  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
      message?: string | string[];
    };
    if (payload?.error) {
      code = payload.error.code ?? code;
      message = payload.error.message ?? message;
      details = payload.error.details;
    } else if (payload?.message) {
      message = Array.isArray(payload.message) ? payload.message.join(", ") : payload.message;
    }
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(response.status, code, message, details);
}

async function doFetch(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    cache: "no-store",
  });
}

const refreshInflight = new Map<Scope, Promise<boolean>>();

async function doRefresh(scope: Scope): Promise<boolean> {
  const store = sessionStore(scope);
  const session = store.get();
  if (!session?.refreshToken) return false;
  try {
    const response = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
      user?: Session["user"];
      tenant?: Session["tenant"];
    };
    store.set({
      ...session,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: payload.user ?? session.user,
      tenant: payload.tenant ?? session.tenant,
    });
    return true;
  } catch {
    return false;
  }
}

function tryRefresh(scope: Scope): Promise<boolean> {
  const existing = refreshInflight.get(scope);
  if (existing) return existing;
  const promise = doRefresh(scope).finally(() => refreshInflight.delete(scope));
  refreshInflight.set(scope, promise);
  return promise;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const scope = options.scope;
  const useAuth = options.auth ?? Boolean(scope);
  const store = scope ? sessionStore(scope) : null;
  let token = useAuth && store ? store.get()?.accessToken ?? null : null;

  let response = await doFetch(path, options, token);

  if (response.status === 401 && useAuth && scope && options.retryOn401 !== false) {
    const refreshed = await tryRefresh(scope);
    if (refreshed) {
      token = store?.get()?.accessToken ?? null;
      response = await doFetch(path, options, token);
    } else {
      store?.set(null);
      authExpiredHandler?.();
    }
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(path: string, options: RequestOptions = {}) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

export async function downloadFile(path: string, options: RequestOptions = {}): Promise<void> {
  const scope = options.scope;
  const useAuth = options.auth ?? Boolean(scope);
  const store = scope ? sessionStore(scope) : null;
  let token = useAuth && store ? store.get()?.accessToken ?? null : null;

  let response = await doFetch(path, options, token);

  if (response.status === 401 && useAuth && scope && options.retryOn401 !== false) {
    const refreshed = await tryRefresh(scope);
    if (refreshed) {
      token = store?.get()?.accessToken ?? null;
      response = await doFetch(path, options, token);
    } else {
      store?.set(null);
      authExpiredHandler?.();
    }
  }

  if (!response.ok) throw await parseError(response);

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = match?.[1] ?? path.split("/").pop() ?? "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function publicApi<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
  user: Session["user"];
  tenant: Session["tenant"];
}

export async function loginStaff(slug: string, email: string, password: string): Promise<Session> {
  const result = await api.post<AuthResult>("/auth/login", { slug, email, password });
  const session: Session = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
    tenant: result.tenant,
  };
  sessionStore("staff").set(session);
  return session;
}

export async function loginPatron(slug: string, email: string, password: string): Promise<Session> {
  const result = await api.post<AuthResult>("/auth/login", { slug, email, password });
  const session: Session = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
    tenant: result.tenant,
  };
  sessionStore("patron").set(session);
  return session;
}

export async function loginPlatform(email: string, password: string): Promise<Session> {
  const result = await api.post<AuthResult>("/auth/platform/login", { email, password });
  const session: Session = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
    tenant: null,
  };
  sessionStore("platform").set(session);
  return session;
}

export async function logout(scope: Scope): Promise<void> {
  const store = sessionStore(scope);
  const session = store.get();
  store.set(null);
  if (session?.refreshToken) {
    try {
      await api.post("/auth/logout", { refreshToken: session.refreshToken });
    } catch {
      /* best-effort */
    }
  }
}

export async function registerTenant(input: {
  slug: string;
  libraryName: string;
  name: string;
  email: string;
  password: string;
}): Promise<Session> {
  const result = await api.post<AuthResult>("/auth/register", input);
  const session: Session = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
    tenant: result.tenant,
  };
  sessionStore("staff").set(session);
  return session;
}
