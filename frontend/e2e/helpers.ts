export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:18081";
export const PASSWORD = "Password123!";
export const SLUG = "riverside";
export const LIBRARY_NAME = "Riverside Public Library";

export function stateFor(role: "admin" | "librarian" | "assistant" | "platform" | "patron"): string {
  return `e2e/.auth/${role}.json`;
}

export function unique(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

export function apiUrl(path: string): string {
  return `${BASE}/api/v1${path}`;
}
