import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike, or, sql as dsql } from "drizzle-orm";
import { books, branches, copies } from "../../db/schema";
import type { BookStatus, Copy, CopyStatus } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { pgErrorCode } from "../../db/pg-errors";
import { badRequest, conflict, forbidden, notFound } from "../../common/errors";
import { AuditService } from "../../common/audit.service";
import { pageMeta, pageParams } from "../../common/pagination";
import { lookupIsbn } from "./isbn";
import type { CreateBookInput, CreateCopiesInput, UpdateBookInput, UpdateCopyInput } from "./dto";

const bookColumns = {
  id: books.id,
  title: books.title,
  subtitle: books.subtitle,
  authors: books.authors,
  isbn13: books.isbn13,
  isbn10: books.isbn10,
  publisher: books.publisher,
  publishedYear: books.publishedYear,
  language: books.language,
  pages: books.pages,
  description: books.description,
  coverUrl: books.coverUrl,
  categories: books.categories,
  tags: books.tags,
  dewey: books.dewey,
  status: books.status,
  metadata: books.metadata,
  createdAt: books.createdAt,
  updatedAt: books.updatedAt,
};

@Injectable()
export class BooksService {
  constructor(private readonly audit: AuditService) {}

  private ctx() {
    const store = requestDb.getStore();
    if (!store?.tenantId) throw forbidden("no_tenant", "No tenant context for this request");
    return { tenantId: store.tenantId, actorId: store.userId ?? null };
  }

  async list(query: {
    q?: string;
    category?: string;
    status?: BookStatus;
    page?: number;
    perPage?: number;
    sort?: "recent" | "title";
  }) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const params = pageParams(query);
    const filters = [eq(books.tenantId, tenantId)];
    if (query.status) {
      filters.push(eq(books.status, query.status));
    } else {
      filters.push(eq(books.status, "active"));
    }
    if (query.category) {
      filters.push(dsql`${books.categories} && array[${query.category}]::text[]`);
    }
    if (query.q) {
      const q = query.q;
      filters.push(
        dsql`(search_vector @@ plainto_tsquery('simple', ${q})
          or lower(${books.title}) like ${`%${q.toLowerCase()}%`}
          or ${books.isbn13} = ${q}
          or ${books.isbn10} = ${q})`,
      );
    }
    const where = and(...filters);

    const items = await db
      .select({
        ...bookColumns,
        copiesTotal: dsql<number>`(select count(*)::int from copies where copies.book_id = books.id)`,
        copiesAvailable: dsql<number>`(select count(*)::int from copies where copies.book_id = books.id and copies.status = 'available')`,
      })
      .from(books)
      .where(where)
      .orderBy(query.sort === "title" ? asc(books.title) : desc(books.createdAt))
      .limit(params.perPage)
      .offset(params.offset);

    const countRows = await db
      .select({ total: dsql<number>`count(*)::int` })
      .from(books)
      .where(where);
    return { items, meta: pageMeta(params, countRows[0]?.total ?? 0) };
  }

  async get(bookId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select({
        ...bookColumns,
        copiesTotal: dsql<number>`(select count(*)::int from copies where copies.book_id = books.id)`,
        copiesAvailable: dsql<number>`(select count(*)::int from copies where copies.book_id = books.id and copies.status = 'available')`,
      })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.tenantId, tenantId)))
      .limit(1);
    const book = rows[0];
    if (!book) throw notFound("book_not_found", "Book not found");

    const copyRows = await db
      .select({
        id: copies.id,
        barcode: copies.barcode,
        status: copies.status,
        condition: copies.condition,
        location: copies.location,
        branchId: copies.branchId,
        branchName: branches.name,
        priceCents: copies.priceCents,
        acquiredAt: copies.acquiredAt,
      })
      .from(copies)
      .leftJoin(branches, eq(copies.branchId, branches.id))
      .where(eq(copies.bookId, bookId))
      .orderBy(asc(copies.barcode));

    return { ...book, copies: copyRows };
  }

  async create(input: CreateBookInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    try {
      const [row] = await db
        .insert(books)
        .values({
          tenantId,
          title: input.title,
          subtitle: input.subtitle ?? null,
          authors: input.authors,
          isbn13: input.isbn13 ?? null,
          isbn10: input.isbn10 ?? null,
          publisher: input.publisher ?? null,
          publishedYear: input.publishedYear ?? null,
          language: input.language,
          pages: input.pages ?? null,
          description: input.description ?? null,
          coverUrl: input.coverUrl ?? null,
          categories: input.categories,
          tags: input.tags,
          dewey: input.dewey ?? null,
          metadata: input.metadata ?? {},
        })
        .returning(bookColumns);
      await this.audit.log({
        action: "book.created",
        entityType: "book",
        entityId: row.id,
        actorUserId: actorId,
        metadata: { title: row.title },
      });
      return row;
    } catch (err) {
      if (pgErrorCode(err) === "23505") {
        throw conflict("isbn_taken", "A book with that ISBN already exists in your catalog");
      }
      throw err;
    }
  }

  async update(bookId: string, input: UpdateBookInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const existing = await db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.tenantId, tenantId)))
      .limit(1);
    if (existing.length === 0) throw notFound("book_not_found", "Book not found");
    if (Object.values(input).every((value) => value === undefined)) {
      throw badRequest("no_changes", "Provide at least one field to update");
    }
    try {
      const [row] = await db
        .update(books)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
          ...(input.authors !== undefined ? { authors: input.authors } : {}),
          ...(input.isbn13 !== undefined ? { isbn13: input.isbn13 } : {}),
          ...(input.isbn10 !== undefined ? { isbn10: input.isbn10 } : {}),
          ...(input.publisher !== undefined ? { publisher: input.publisher } : {}),
          ...(input.publishedYear !== undefined ? { publishedYear: input.publishedYear } : {}),
          ...(input.language !== undefined ? { language: input.language } : {}),
          ...(input.pages !== undefined ? { pages: input.pages } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
          ...(input.categories !== undefined ? { categories: input.categories } : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
          ...(input.dewey !== undefined ? { dewey: input.dewey } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        })
        .where(eq(books.id, bookId))
        .returning(bookColumns);
      await this.audit.log({
        action: "book.updated",
        entityType: "book",
        entityId: bookId,
        actorUserId: actorId,
        metadata: { fields: Object.keys(input) },
      });
      return row;
    } catch (err) {
      if (pgErrorCode(err) === "23505") {
        throw conflict("isbn_taken", "A book with that ISBN already exists in your catalog");
      }
      throw err;
    }
  }

  async setStatus(bookId: string, status: BookStatus) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const [row] = await db
      .update(books)
      .set({ status })
      .where(and(eq(books.id, bookId), eq(books.tenantId, tenantId)))
      .returning(bookColumns);
    if (!row) throw notFound("book_not_found", "Book not found");
    await this.audit.log({
      action: status === "archived" ? "book.archived" : "book.restored",
      entityType: "book",
      entityId: bookId,
      actorUserId: actorId,
    });
    return row;
  }

  async lookupIsbn(isbn: string) {
    const result = await lookupIsbn(isbn);
    if (!result) throw notFound("isbn_not_found", "No metadata found for that ISBN");
    return result;
  }

  async listCopies(bookId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const book = await db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.tenantId, tenantId)))
      .limit(1);
    if (book.length === 0) throw notFound("book_not_found", "Book not found");
    return db
      .select({
        id: copies.id,
        barcode: copies.barcode,
        status: copies.status,
        condition: copies.condition,
        location: copies.location,
        branchId: copies.branchId,
        branchName: branches.name,
        priceCents: copies.priceCents,
        acquiredAt: copies.acquiredAt,
        notes: copies.notes,
        createdAt: copies.createdAt,
      })
      .from(copies)
      .leftJoin(branches, eq(copies.branchId, branches.id))
      .where(eq(copies.bookId, bookId))
      .orderBy(asc(copies.barcode));
  }

  async createCopies(bookId: string, input: CreateCopiesInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const book = await db
      .select({ id: books.id, title: books.title })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.tenantId, tenantId)))
      .limit(1);
    if (book.length === 0) throw notFound("book_not_found", "Book not found");

    const branch = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)))
      .limit(1);
    if (branch.length === 0) throw badRequest("branch_not_found", "Branch not found");

    if (input.barcodes && input.barcodes.length !== input.count) {
      throw badRequest(
        "barcode_count_mismatch",
        "Provide exactly one barcode per copy, or omit barcodes to auto-generate them",
      );
    }
    const count = input.barcodes?.length ?? input.count;
    const barcodes = input.barcodes ?? Array.from({ length: count }, () => `BC${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`);

    try {
      const rows = await db
        .insert(copies)
        .values(
          barcodes.map((barcode) => ({
            tenantId,
            bookId,
            branchId: input.branchId,
            barcode,
            condition: input.condition ?? null,
            location: input.location ?? null,
            priceCents: input.priceCents ?? null,
            acquiredAt: input.acquiredAt ?? null,
          })),
        )
        .returning({
          id: copies.id,
          barcode: copies.barcode,
          status: copies.status,
          branchId: copies.branchId,
          location: copies.location,
          condition: copies.condition,
          priceCents: copies.priceCents,
          acquiredAt: copies.acquiredAt,
        });
      await this.audit.log({
        action: "copy.created",
        entityType: "book",
        entityId: bookId,
        actorUserId: actorId,
        metadata: { count: rows.length, barcodes: rows.map((row) => row.barcode) },
      });
      return rows;
    } catch (err) {
      if (pgErrorCode(err) === "23505") {
        throw conflict("barcode_taken", "One of those barcodes is already in use");
      }
      throw err;
    }
  }

  async updateCopy(copyId: string, input: UpdateCopyInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const rows = await db
      .select()
      .from(copies)
      .where(and(eq(copies.id, copyId), eq(copies.tenantId, tenantId)))
      .limit(1);
    const copy = rows[0];
    if (!copy) throw notFound("copy_not_found", "Copy not found");
    if (Object.values(input).every((value) => value === undefined)) {
      throw badRequest("no_changes", "Provide at least one field to update");
    }
    if (copy.status === "on_loan" && input.status && input.status !== "lost") {
      throw conflict("copy_on_loan", "This copy is currently on loan. Check it in first.");
    }

    if (input.branchId) {
      const branch = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)))
        .limit(1);
      if (branch.length === 0) throw badRequest("branch_not_found", "Branch not found");
    }

    const [row] = await db
      .update(copies)
      .set({
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.status !== undefined ? { status: input.status as CopyStatus } : {}),
        ...(input.condition !== undefined ? { condition: input.condition } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      })
      .where(eq(copies.id, copyId))
      .returning();
    await this.audit.log({
      action: "copy.updated",
      entityType: "copy",
      entityId: copyId,
      actorUserId: actorId,
      metadata: { fields: Object.keys(input), from: copy.status, to: input.status ?? copy.status },
    });
    return row;
  }

  async withdrawCopy(copyId: string) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const rows = await db
      .select()
      .from(copies)
      .where(and(eq(copies.id, copyId), eq(copies.tenantId, tenantId)))
      .limit(1);
    const copy = rows[0];
    if (!copy) throw notFound("copy_not_found", "Copy not found");
    if (copy.status === "on_loan") {
      throw conflict("copy_on_loan", "This copy is currently on loan. Check it in first.");
    }
    await db.update(copies).set({ status: "withdrawn" }).where(eq(copies.id, copyId));
    await this.audit.log({
      action: "copy.withdrawn",
      entityType: "copy",
      entityId: copyId,
      actorUserId: actorId,
      metadata: { barcode: copy.barcode },
    });
  }

  async findByBarcode(barcode: string): Promise<Copy | undefined> {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select()
      .from(copies)
      .where(and(eq(copies.tenantId, tenantId), eq(copies.barcode, barcode)))
      .limit(1);
    return rows[0];
  }

  async categories() {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select({ category: dsql<string>`distinct unnest(${books.categories})` })
      .from(books)
      .where(eq(books.tenantId, tenantId))
      .orderBy(dsql`1`);
    return rows.map((row) => row.category).filter((value): value is string => Boolean(value));
  }

  async searchTitles(q: string, limit: number) {
    const db = getDb();
    const { tenantId } = this.ctx();
    return db
      .select({ id: books.id, title: books.title, authors: books.authors })
      .from(books)
      .where(
        and(
          eq(books.tenantId, tenantId),
          eq(books.status, "active"),
          or(
            ilike(books.title, `%${q}%`),
            dsql`${books.isbn13} = ${q}`,
          ),
        ),
      )
      .orderBy(asc(books.title))
      .limit(Math.min(25, Math.max(1, limit)));
  }
}
