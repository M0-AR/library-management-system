import { Injectable } from "@nestjs/common";
import { desc, eq, sql as dsql } from "drizzle-orm";
import { books, branches, copies, fines, loans, members } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { badRequest, forbidden } from "../../common/errors";

const EXPORT_ROW_LIMIT = 20000;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return `${lines.join("\n")}\n`;
}

function cents(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : (value / 100).toFixed(2);
}

function datedFilename(resource: string): string {
  return `${resource}-${new Date().toISOString().slice(0, 10)}.csv`;
}

@Injectable()
export class ExportsService {
  private ctx(): { tenantId: string } {
    const store = requestDb.getStore();
    if (!store?.tenantId) throw forbidden("no_tenant", "No tenant context for this request");
    return { tenantId: store.tenantId };
  }

  async build(resource: string): Promise<{ filename: string; csv: string }> {
    switch (resource) {
      case "loans":
        return this.loans();
      case "members":
        return this.members();
      case "fines":
        return this.fines();
      default:
        throw badRequest("unknown_export", `Unknown export resource: ${resource}`);
    }
  }

  private async loans(): Promise<{ filename: string; csv: string }> {
    const { tenantId } = this.ctx();
    const rows = await getDb()
      .select({
        barcode: copies.barcode,
        title: books.title,
        authors: dsql<string>`array_to_string(${books.authors}, '; ')`,
        member: members.fullName,
        card: members.cardNumber,
        branch: branches.name,
        status: loans.status,
        checkedOutAt: loans.checkedOutAt,
        dueAt: loans.dueAt,
        returnedAt: loans.returnedAt,
        renewals: loans.renewedCount,
      })
      .from(loans)
      .innerJoin(copies, eq(copies.id, loans.copyId))
      .innerJoin(books, eq(books.id, loans.bookId))
      .innerJoin(members, eq(members.id, loans.memberId))
      .innerJoin(branches, eq(branches.id, loans.branchId))
      .where(eq(loans.tenantId, tenantId))
      .orderBy(desc(loans.checkedOutAt))
      .limit(EXPORT_ROW_LIMIT);
    const csv = toCsv(
      [
        "barcode",
        "title",
        "authors",
        "member",
        "card_number",
        "branch",
        "status",
        "checked_out_at",
        "due_at",
        "returned_at",
        "renewals",
      ],
      rows.map((row) => [
        row.barcode,
        row.title,
        row.authors,
        row.member,
        row.card,
        row.branch,
        row.status,
        row.checkedOutAt,
        row.dueAt,
        row.returnedAt,
        row.renewals,
      ]),
    );
    return { filename: datedFilename("loans"), csv };
  }

  private async members(): Promise<{ filename: string; csv: string }> {
    const { tenantId } = this.ctx();
    const rows = await getDb()
      .select({
        card: members.cardNumber,
        name: members.fullName,
        email: members.email,
        phone: members.phone,
        category: members.category,
        status: members.status,
        joinedAt: members.joinedAt,
        expiresAt: members.expiresAt,
        notes: members.notes,
      })
      .from(members)
      .where(eq(members.tenantId, tenantId))
      .orderBy(members.fullName)
      .limit(EXPORT_ROW_LIMIT);
    const csv = toCsv(
      ["card_number", "full_name", "email", "phone", "category", "status", "joined_at", "expires_at", "notes"],
      rows.map((row) => [
        row.card,
        row.name,
        row.email,
        row.phone,
        row.category,
        row.status,
        row.joinedAt,
        row.expiresAt,
        row.notes,
      ]),
    );
    return { filename: datedFilename("members"), csv };
  }

  private async fines(): Promise<{ filename: string; csv: string }> {
    const { tenantId } = this.ctx();
    const rows = await getDb()
      .select({
        member: members.fullName,
        card: members.cardNumber,
        type: fines.type,
        amountCents: fines.amountCents,
        currency: fines.currency,
        status: fines.status,
        note: fines.note,
        createdAt: fines.createdAt,
        paidAt: fines.paidAt,
      })
      .from(fines)
      .innerJoin(members, eq(members.id, fines.memberId))
      .where(eq(fines.tenantId, tenantId))
      .orderBy(desc(fines.createdAt))
      .limit(EXPORT_ROW_LIMIT);
    const csv = toCsv(
      ["member", "card_number", "type", "amount", "currency", "status", "note", "created_at", "paid_at"],
      rows.map((row) => [
        row.member,
        row.card,
        row.type,
        cents(row.amountCents),
        row.currency,
        row.status,
        row.note,
        row.createdAt,
        row.paidAt,
      ]),
    );
    return { filename: datedFilename("fines"), csv };
  }
}
