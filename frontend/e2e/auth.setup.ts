import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:18081";
const AUTH_DIR = path.join(__dirname, ".auth");

function cachedSessionIsFresh(file: string, scope: string): boolean {
  try {
    const state = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, `${file}.json`), "utf8")) as {
      origins?: { localStorage?: { name: string; value: string }[] }[];
    };
    const raw = state.origins?.[0]?.localStorage?.find((item) => item.name === `lc.session.${scope}`)?.value;
    if (!raw) return false;
    const { accessToken } = JSON.parse(raw) as { accessToken?: string };
    if (!accessToken) return false;
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof payload.exp === "number" && payload.exp * 1000 - Date.now() > 120_000;
  } catch {
    return false;
  }
}

export const ROLES = [
  { file: "admin", scope: "staff", slug: "riverside", email: "admin@riverside.test" },
  { file: "librarian", scope: "staff", slug: "riverside", email: "librarian@riverside.test" },
  { file: "assistant", scope: "staff", slug: "riverside", email: "assistant@riverside.test" },
  { file: "platform", scope: "platform", slug: null, email: "platform@lms.test" },
  { file: "patron", scope: "patron", slug: "riverside", email: "jane@example.com" },
] as const;

for (const role of ROLES) {
  setup(`authenticate ${role.file}`, async ({ request }) => {
    setup.skip(cachedSessionIsFresh(role.file, role.scope), "reusing cached session");
    const response = role.slug
      ? await request.post(`${BASE}/api/v1/auth/login`, {
          data: { slug: role.slug, email: role.email, password: "Password123!" },
        })
      : await request.post(`${BASE}/api/v1/auth/platform/login`, {
          data: { email: role.email, password: "Password123!" },
        });
    expect(response.ok(), `${role.file}: ${response.status()} ${await response.text()}`).toBeTruthy();
    const auth = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
      user: unknown;
      tenant: unknown;
    };
    const session = {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      user: auth.user,
      tenant: auth.tenant ?? null,
    };
    const state = {
      cookies: [],
      origins: [
        {
          origin: BASE,
          localStorage: [{ name: `lc.session.${role.scope}`, value: JSON.stringify(session) }],
        },
      ],
    };
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    fs.writeFileSync(path.join(AUTH_DIR, `${role.file}.json`), JSON.stringify(state, null, 2));
  });
}
