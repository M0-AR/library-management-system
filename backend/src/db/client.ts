import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Sql = postgres.Sql<Record<string, never>>;
export type SqlTx = postgres.TransactionSql<Record<string, never>>;

export interface TenantContextOptions {
  tenantId?: string | null;
  userId?: string | null;
  isPlatformAdmin?: boolean;
  platformLogin?: boolean;
  publicLookup?: boolean;
  refreshLookup?: boolean;
}

export interface RequestStore extends TenantContextOptions {
  db: Db;
  tx: SqlTx;
}

export const requestDb = new AsyncLocalStorage<RequestStore>();

let rootSql: Sql | null = null;
let rootDb: Db | null = null;

export function initDb(url: string, opts: { max?: number } = {}): void {
  if (rootSql) return;
  rootSql = postgres(url, {
    max: opts.max ?? 20,
    idle_timeout: 30,
    connect_timeout: 15,
    onnotice: () => {},
  });
  rootDb = drizzle(rootSql, { schema });
}

export async function closeDb(): Promise<void> {
  if (rootSql) {
    await rootSql.end({ timeout: 5 });
    rootSql = null;
    rootDb = null;
  }
}

export function sql(): Sql {
  if (!rootSql) throw new Error("Database not initialized. Call initDb() first.");
  return rootSql;
}

export function getDb(): Db {
  const store = requestDb.getStore();
  if (store) return store.db;
  if (!rootDb) throw new Error("Database not initialized. Call initDb() first.");
  return rootDb;
}

export function getTx(): SqlTx {
  const store = requestDb.getStore();
  if (!store) throw new Error("No tenant transaction context available");
  return store.tx;
}

async function applyContext(tx: SqlTx, o: TenantContextOptions): Promise<void> {
  await tx`select
    set_config('app.current_tenant', ${o.tenantId ?? ""}, true),
    set_config('app.current_user_id', ${o.userId ?? ""}, true),
    set_config('app.is_platform_admin', ${o.isPlatformAdmin ? "true" : "false"}, true),
    set_config('app.platform_login', ${o.platformLogin ? "true" : "false"}, true),
    set_config('app.public_lookup', ${o.publicLookup ? "true" : "false"}, true),
    set_config('app.refresh_lookup', ${o.refreshLookup ? "true" : "false"}, true)`;
}

export async function updateContext(overrides: Partial<TenantContextOptions>): Promise<void> {
  const store = requestDb.getStore();
  if (!store) throw new Error("No tenant transaction context available");
  await applyContext(store.tx, { ...store, ...overrides });
  Object.assign(store, overrides);
}

export async function withTenantContext<T>(
  options: TenantContextOptions,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const root = sql();
  const result = await root.begin(async (tx) => {
    await applyContext(tx, options);
    const db = drizzle(asDrizzleClient(tx, root), { schema });
    return requestDb.run({ ...options, db, tx }, () => fn(db));
  });
  return result as unknown as T;
}

export async function withSavepoint<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const store = requestDb.getStore();
  if (!store) return fn(getDb());
  const root = sql();
  const result = await store.tx.savepoint(async (sp) => {
    const db = drizzle(asDrizzleClient(sp as unknown as SqlTx, root), { schema });
    return fn(db);
  });
  return result as unknown as T;
}

function asDrizzleClient(tx: SqlTx, root: Sql): Sql {
  const client = tx as SqlTx & { options?: Sql["options"] };
  if (!client.options) client.options = root.options;
  return client as unknown as Sql;
}
