import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { and, desc, eq, sql as dsql } from "drizzle-orm";
import { notifications, tenants } from "../../db/schema";
import type { Member } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { env } from "../../env";
import { pageMeta, pageParams } from "../../common/pagination";
import { parseTenantSettings } from "../tenants/tenant-settings";
import { dueSoonEmail, holdReadyEmail, overdueEmail, welcomeEmail } from "./templates";

interface SendParams {
  tenantId?: string;
  memberId?: string | null;
  userId?: string | null;
  loanId?: string | null;
  template: string;
  to: string | null;
  subject: string;
  body: string;
}

export interface ListNotificationsQuery {
  status?: "queued" | "sent" | "failed";
  page?: number;
  perPage?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transport: Transporter | null | undefined;

  private getTransport(): Transporter | null {
    if (this.transport !== undefined) return this.transport;
    const e = env();
    if (!e.SMTP_HOST) {
      this.transport = null;
      return null;
    }
    this.transport = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_PORT === 465,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS ?? "" } : undefined,
    });
    return this.transport;
  }

  private async tenantContext(): Promise<{ tenantId: string; libraryName: string } | null> {
    const store = requestDb.getStore();
    if (!store?.tenantId) return null;
    const rows = await getDb()
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, store.tenantId))
      .limit(1);
    return { tenantId: store.tenantId, libraryName: rows[0]?.name ?? "the library" };
  }

  async send(params: SendParams): Promise<void> {
    try {
      const store = requestDb.getStore();
      const tenantId = params.tenantId ?? store?.tenantId;
      if (!tenantId) {
        this.logger.warn(`Notification ${params.template} skipped: no tenant context`);
        return;
      }
      const db = getDb();
      const [row] = await db
        .insert(notifications)
        .values({
          tenantId,
          memberId: params.memberId ?? null,
          userId: params.userId ?? null,
          loanId: params.loanId ?? null,
          channel: "email",
          template: params.template,
          subject: params.subject,
          body: params.body,
        })
        .returning({ id: notifications.id });

      const transport = this.getTransport();
      if (!transport || !params.to) {
        await db
          .update(notifications)
          .set({
            status: "failed",
            error: transport ? "no_recipient_email" : "smtp_not_configured",
          })
          .where(eq(notifications.id, row.id));
        return;
      }

      try {
        await transport.sendMail({
          from: env().SMTP_FROM,
          to: params.to,
          subject: params.subject,
          text: params.body,
        });
        await db
          .update(notifications)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(notifications.id, row.id));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to send notification ${params.template}: ${message}`);
        await db
          .update(notifications)
          .set({ status: "failed", error: message.slice(0, 500) })
          .where(eq(notifications.id, row.id));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Notification ${params.template} could not be recorded: ${message}`);
    }
  }

  async sendHoldReady(params: { member: Member; bookTitle: string; expiresAt: Date }): Promise<void> {
    const context = await this.tenantContext();
    if (!context) return;
    const settings = await this.settings();
    if (!settings.notifications.emailEnabled || !settings.notifications.holdReadyEmails) return;
    if (!params.member.email) return;
    const template = holdReadyEmail({
      memberName: params.member.fullName,
      bookTitle: params.bookTitle,
      libraryName: context.libraryName,
      expiresAt: params.expiresAt,
    });
    await this.send({
      memberId: params.member.id,
      template: "hold_ready",
      to: params.member.email,
      subject: template.subject,
      body: template.body,
    });
  }

  async sendDueSoon(params: {
    member: Member;
    bookTitle: string;
    dueAt: Date;
    loanId?: string;
  }): Promise<void> {
    const context = await this.tenantContext();
    if (!context) return;
    const settings = await this.settings();
    if (!settings.notifications.emailEnabled) return;
    if (!params.member.email) return;
    const template = dueSoonEmail({
      memberName: params.member.fullName,
      bookTitle: params.bookTitle,
      libraryName: context.libraryName,
      dueAt: params.dueAt,
    });
    await this.send({
      memberId: params.member.id,
      loanId: params.loanId,
      template: "due_soon",
      to: params.member.email,
      subject: template.subject,
      body: template.body,
    });
  }

  async sendOverdue(params: {
    member: Member;
    bookTitle: string;
    dueAt: Date;
    fineCents: number;
    loanId?: string;
  }): Promise<void> {
    const context = await this.tenantContext();
    if (!context) return;
    const settings = await this.settings();
    if (!settings.notifications.emailEnabled || !settings.notifications.overdueRemindersEnabled) return;
    if (!params.member.email) return;
    const template = overdueEmail({
      memberName: params.member.fullName,
      bookTitle: params.bookTitle,
      libraryName: context.libraryName,
      dueAt: params.dueAt,
      fineCents: params.fineCents,
    });
    await this.send({
      memberId: params.member.id,
      loanId: params.loanId,
      template: "overdue",
      to: params.member.email,
      subject: template.subject,
      body: template.body,
    });
  }

  async sendWelcome(params: { member: Member; cardNumber: string }): Promise<void> {
    const context = await this.tenantContext();
    if (!context) return;
    const settings = await this.settings();
    if (!settings.notifications.emailEnabled) return;
    if (!params.member.email) return;
    const template = welcomeEmail({
      memberName: params.member.fullName,
      libraryName: context.libraryName,
      cardNumber: params.cardNumber,
    });
    await this.send({
      memberId: params.member.id,
      template: "welcome",
      to: params.member.email,
      subject: template.subject,
      body: template.body,
    });
  }

  async list(query: ListNotificationsQuery) {
    const db = getDb();
    const params = pageParams(query);
    const filters = query.status ? [eq(notifications.status, query.status)] : [];
    const where = filters.length ? and(...filters) : undefined;
    const items = await db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(params.perPage)
      .offset(params.offset);
    const countRows = await db
      .select({ total: dsql<number>`count(*)::int` })
      .from(notifications)
      .where(where);
    return { items, meta: pageMeta(params, countRows[0]?.total ?? 0) };
  }

  private async settings() {
    const store = requestDb.getStore();
    const rows = await getDb()
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, store!.tenantId!))
      .limit(1);
    return parseTenantSettings(rows[0]?.settings);
  }
}
