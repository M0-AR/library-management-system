import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type TenantStatus = "active" | "trial" | "suspended" | "cancelled";
export type TenantPlan = "free" | "starter" | "growth" | "enterprise";
export type UserRole =
  | "platform_admin"
  | "tenant_admin"
  | "librarian"
  | "assistant"
  | "patron";
export type MemberCategory =
  | "child"
  | "student"
  | "adult"
  | "senior"
  | "teacher"
  | "staff"
  | "external";
export type MemberStatus = "active" | "suspended" | "expired" | "closed";
export type CopyStatus =
  | "available"
  | "on_loan"
  | "reserved"
  | "lost"
  | "damaged"
  | "withdrawn";
export type LoanStatus = "active" | "overdue" | "returned";
export type HoldStatus =
  | "pending"
  | "ready"
  | "fulfilled"
  | "cancelled"
  | "expired";
export type FineType = "overdue" | "lost" | "damaged" | "manual";
export type FineStatus = "outstanding" | "paid" | "waived";
export type BookStatus = "active" | "archived";
export type DomainStatus = "pending" | "verified" | "failed";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").$type<TenantStatus>().notNull().default("active"),
  plan: text("plan").$type<TenantPlan>().notNull().default("free"),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  domain: text("domain").notNull().unique(),
  verificationToken: text("verification_token").notNull(),
  status: text("status").$type<DomainStatus>().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    address: text("address"),
    phone: text("phone"),
    status: text("status").$type<"active" | "inactive">().notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("branches_tenant_code_uq").on(t.tenantId, t.code)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role").$type<UserRole>().notNull(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    status: text("status").$type<"active" | "disabled">().notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("users_tenant_idx").on(t.tenantId),
    uniqueIndex("users_tenant_email_uq")
      .on(t.tenantId, sql`lower(${t.email})`)
      .where(sql`${t.tenantId} is not null`),
    uniqueIndex("users_platform_email_uq")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.tenantId} is null`),
  ],
);

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    cardNumber: text("card_number").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    category: text("category").$type<MemberCategory>().notNull().default("adult"),
    status: text("status").$type<MemberStatus>().notNull().default("active"),
    joinedAt: date("joined_at", { mode: "string" })
      .notNull()
      .default(sql`current_date`),
    expiresAt: date("expires_at", { mode: "string" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("members_tenant_card_uq").on(t.tenantId, t.cardNumber),
    index("members_tenant_status_idx").on(t.tenantId, t.status),
    index("members_user_idx")
      .on(t.userId)
      .where(sql`${t.userId} is not null`),
  ],
);

export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    authors: text("authors").array().notNull().default(sql`'{}'::text[]`),
    isbn13: text("isbn13"),
    isbn10: text("isbn10"),
    publisher: text("publisher"),
    publishedYear: integer("published_year"),
    language: text("language").notNull().default("en"),
    pages: integer("pages"),
    description: text("description"),
    coverUrl: text("cover_url"),
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    dewey: text("dewey"),
    status: text("status").$type<BookStatus>().notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index("books_tenant_status_idx").on(t.tenantId, t.status),
    uniqueIndex("books_tenant_isbn_uq")
      .on(t.tenantId, t.isbn13)
      .where(sql`${t.isbn13} is not null`),
  ],
);

export const copies = pgTable(
  "copies",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    barcode: text("barcode").notNull(),
    status: text("status").$type<CopyStatus>().notNull().default("available"),
    condition: text("condition"),
    location: text("location"),
    acquiredAt: date("acquired_at", { mode: "string" }),
    priceCents: integer("price_cents"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("copies_tenant_barcode_uq").on(t.tenantId, t.barcode),
    index("copies_tenant_book_idx").on(t.tenantId, t.bookId),
    index("copies_tenant_status_idx").on(t.tenantId, t.status),
  ],
);

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    copyId: uuid("copy_id")
      .notNull()
      .references(() => copies.id, { onDelete: "restrict" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    checkedOutBy: uuid("checked_out_by").references(() => users.id, {
      onDelete: "set null",
    }),
    checkedInBy: uuid("checked_in_by").references(() => users.id, {
      onDelete: "set null",
    }),
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    renewedCount: integer("renewed_count").notNull().default(0),
    status: text("status").$type<LoanStatus>().notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    index("loans_tenant_status_due_idx").on(t.tenantId, t.status, t.dueAt),
    index("loans_tenant_member_idx").on(t.tenantId, t.memberId, t.status),
    index("loans_tenant_copy_idx").on(t.tenantId, t.copyId, t.status),
    uniqueIndex("loans_active_copy_uq")
      .on(t.tenantId, t.copyId)
      .where(sql`status in ('active','overdue')`),
  ],
);

export const holds = pgTable(
  "holds",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    status: text("status").$type<HoldStatus>().notNull().default("pending"),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("holds_tenant_book_idx").on(t.tenantId, t.bookId, t.status, t.placedAt),
    index("holds_tenant_member_idx").on(t.tenantId, t.memberId, t.status),
  ],
);

export const fines = pgTable(
  "fines",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    loanId: uuid("loan_id").references(() => loans.id, { onDelete: "set null" }),
    type: text("type").$type<FineType>().notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: text("status").$type<FineStatus>().notNull().default("outstanding"),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("fines_tenant_status_idx").on(t.tenantId, t.status),
    index("fines_tenant_member_idx").on(t.tenantId, t.memberId, t.status),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    loanId: uuid("loan_id").references(() => loans.id, { onDelete: "set null" }),
    channel: text("channel").$type<"email" | "sms" | "in_app">().notNull().default("email"),
    template: text("template").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<"queued" | "sent" | "failed">().notNull().default("queued"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("notifications_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    replacedById: uuid("replaced_by_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("refresh_tokens_user_idx").on(t.userId)],
);

export type Tenant = typeof tenants.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type User = typeof users.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Book = typeof books.$inferSelect;
export type Copy = typeof copies.$inferSelect;
export type Loan = typeof loans.$inferSelect;
export type Hold = typeof holds.$inferSelect;
export type Fine = typeof fines.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
