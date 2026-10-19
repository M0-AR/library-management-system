export type Scope = "staff" | "platform" | "patron";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "platform_admin" | "tenant_admin" | "librarian" | "assistant" | "patron";
  tenantId: string | null;
  branchId?: string | null;
  memberId?: string | null;
  status?: string;
}

export interface SessionTenant {
  id: string;
  slug: string;
  name: string;
  status?: string;
  plan?: string;
  settings?: unknown;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  tenant: SessionTenant | null;
}

type Listener = () => void;

class SessionStore {
  private listeners = new Set<Listener>();
  private cache: Record<Scope, Session | null> = {
    staff: null,
    platform: null,
    patron: null,
  };

  constructor(private readonly scope: Scope) {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(this.key());
        if (raw) this.cache[this.scope] = JSON.parse(raw) as Session;
      } catch {
        this.cache[this.scope] = null;
      }
      window.addEventListener("storage", (event) => {
        if (event.key === this.key()) {
          try {
            this.cache[this.scope] = event.newValue
              ? (JSON.parse(event.newValue) as Session)
              : null;
          } catch {
            this.cache[this.scope] = null;
          }
          this.emit();
        }
      });
    }
  }

  private key(): string {
    return `lc.session.${this.scope}`;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  get(): Session | null {
    return this.cache[this.scope];
  }

  set(session: Session | null): void {
    this.cache[this.scope] = session;
    if (typeof window !== "undefined") {
      try {
        if (session) window.localStorage.setItem(this.key(), JSON.stringify(session));
        else window.localStorage.removeItem(this.key());
      } catch {
        /* storage unavailable */
      }
    }
    this.emit();
  }

  patchTokens(accessToken: string, refreshToken: string): void {
    const current = this.get();
    if (!current) return;
    this.set({ ...current, accessToken, refreshToken });
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  snapshot = (): Session | null => this.cache[this.scope];
}

const stores: Record<Scope, SessionStore | null> = {
  staff: null,
  platform: null,
  patron: null,
};

export function sessionStore(scope: Scope): SessionStore {
  const existing = stores[scope];
  if (existing) return existing;
  const created = new SessionStore(scope);
  stores[scope] = created;
  return created;
}
