import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

export interface BootstrapOptions {
  adminUrl: string;
  database: string;
  role: string;
  rolePassword: string;
  migrationsDir: string;
  createDatabase?: boolean;
  logger?: (message: string) => void;
}

const IDENT_RE = /^[a-z_][a-z0-9_]{0,62}$/;
const DB_RE = /^[a-z0-9_]{1,63}$/;

function assertIdent(role: string): void {
  if (!IDENT_RE.test(role)) throw new Error(`Invalid role name: ${role}`);
}

function assertDb(name: string): void {
  if (!DB_RE.test(name)) throw new Error(`Invalid database name: ${name}`);
}

function q(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function withDatabase(url: string, db: string): string {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

export async function runMigrations(
  admin: postgres.Sql,
  migrationsDir: string,
): Promise<{ applied: string[]; skipped: string[] }> {
  await admin.unsafe(
    `create table if not exists _migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())`,
  );
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    const content = await readFile(path.join(migrationsDir, file), "utf8");
    const checksum = createHash("sha256").update(content).digest("hex");
    const rows = (await admin`select checksum from _migrations where name = ${file}`) as Array<{
      checksum: string;
    }>;
    const existing = rows[0];
    if (existing) {
      if (existing.checksum !== checksum) {
        throw new Error(`Migration ${file} was modified after it was applied`);
      }
      skipped.push(file);
      continue;
    }
    await admin.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into _migrations (name, checksum) values (${file}, ${checksum})`;
    });
    applied.push(file);
  }
  return { applied, skipped };
}

export async function grantAppRole(admin: postgres.Sql, role: string): Promise<void> {
  assertIdent(role);
  const r = q(role);
  await admin.unsafe(`grant usage on schema public to ${r}`);
  await admin.unsafe(`grant select, insert, update, delete on all tables in schema public to ${r}`);
  await admin.unsafe(`grant usage, select on all sequences in schema public to ${r}`);
  await admin.unsafe(`grant execute on all functions in schema public to ${r}`);
  await admin.unsafe(`revoke all on table _migrations from ${r}`);
  await admin.unsafe(
    `alter default privileges in schema public grant select, insert, update, delete on tables to ${r}`,
  );
  await admin.unsafe(`alter default privileges in schema public grant usage, select on sequences to ${r}`);
  await admin.unsafe(`alter default privileges in schema public grant execute on functions to ${r}`);
}

export async function runBootstrap(
  opts: BootstrapOptions,
): Promise<{ applied: string[]; skipped: string[] }> {
  const log = opts.logger ?? (() => {});
  assertIdent(opts.role);
  assertDb(opts.database);
  const admin = postgres(opts.adminUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`do $$ begin
      if not exists (select from pg_roles where rolname = ${lit(opts.role)}) then
        create role ${q(opts.role)} login password ${lit(opts.rolePassword)}
          nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
      end if;
    end $$;`);
    await admin.unsafe(
      `alter role ${q(opts.role)} with login password ${lit(opts.rolePassword)}
        nosuperuser nocreatedb nocreaterole noinherit nobypassrls`,
    );

    const dbRows = (await admin`select 1 as x from pg_database where datname = ${opts.database}`) as unknown as Array<{ x: number }>;
    if (dbRows.length === 0) {
      if (!opts.createDatabase) throw new Error(`Database ${opts.database} does not exist`);
      await admin.unsafe(`create database ${q(opts.database)}`);
      log(`created database ${opts.database}`);
    }

    await admin.unsafe(`grant connect on database ${q(opts.database)} to ${q(opts.role)}`);

    const dbAdmin = postgres(withDatabase(opts.adminUrl, opts.database), {
      max: 1,
      onnotice: () => {},
    });
    try {
      const result = await runMigrations(dbAdmin, opts.migrationsDir);
      await grantAppRole(dbAdmin, opts.role);
      log(`migrations: ${result.applied.length} applied, ${result.skipped.length} skipped`);
      return result;
    } finally {
      await dbAdmin.end({ timeout: 5 });
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  const adminUrl = process.env.DATABASE_URL_ADMIN ?? "";
  const appUrl = process.env.DATABASE_URL ?? "";
  if (!adminUrl || !appUrl) {
    console.error("DATABASE_URL_ADMIN and DATABASE_URL are required");
    process.exit(1);
  }
  const database = new URL(appUrl).pathname.replace(/^\//, "");
  const role = process.env.APP_DB_ROLE ?? "app_user";
  const rolePassword = process.env.APP_DB_PASSWORD ?? "";
  const migrationsDir = path.join(__dirname, "..", "db", "migrations");
  const result = await runBootstrap({
    adminUrl,
    database,
    role,
    rolePassword,
    migrationsDir,
    createDatabase: process.env.NODE_ENV !== "test",
    logger: (m) => console.log(m),
  });
  console.log(
    `bootstrap complete: applied ${result.applied.length} migration(s) [${result.applied.join(", ") || "-"}], skipped ${result.skipped.length}`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
