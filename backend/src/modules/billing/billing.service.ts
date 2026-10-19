import { Injectable, Logger } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { tenants } from "../../db/schema";
import type { TenantPlan } from "../../db/schema";
import { getDb, requestDb, withTenantContext } from "../../db/client";
import { apiError, forbidden, unauthorized } from "../../common/errors";
import { AuditService } from "../../common/audit.service";
import { env } from "../../env";

export interface PlanDefinition {
  id: TenantPlan;
  name: string;
  priceCents: number;
  description: string;
  limits: { maxCopies: number; maxMembers: number; staff: number; branches: number };
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceCents: 0,
    description: "For small community libraries getting started",
    limits: { maxCopies: 500, maxMembers: 250, staff: 2, branches: 1 },
  },
  {
    id: "starter",
    name: "Starter",
    priceCents: 2900,
    description: "For single-branch libraries with growing collections",
    limits: { maxCopies: 5000, maxMembers: 2500, staff: 5, branches: 2 },
  },
  {
    id: "growth",
    name: "Growth",
    priceCents: 7900,
    description: "For multi-branch library systems",
    limits: { maxCopies: 50000, maxMembers: 25000, staff: 25, branches: 10 },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceCents: 19900,
    description: "For large consortia with custom requirements",
    limits: { maxCopies: 1000000, maxMembers: 1000000, staff: 500, branches: 1000 },
  },
];

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly audit: AuditService) {}

  private ctx() {
    const store = requestDb.getStore();
    if (!store?.tenantId) throw forbidden("no_tenant", "No tenant context for this request");
    return { tenantId: store.tenantId };
  }

  private priceIdFor(plan: TenantPlan): string | null {
    const e = env();
    const map: Record<string, string | undefined> = {
      starter: e.PADDLE_PRICE_STARTER,
      growth: e.PADDLE_PRICE_GROWTH,
      enterprise: e.PADDLE_PRICE_ENTERPRISE,
    };
    return map[plan] ?? null;
  }

  private planForPriceId(priceId: string): TenantPlan | null {
    const e = env();
    const entries: Array<[TenantPlan, string | undefined]> = [
      ["starter", e.PADDLE_PRICE_STARTER],
      ["growth", e.PADDLE_PRICE_GROWTH],
      ["enterprise", e.PADDLE_PRICE_ENTERPRISE],
    ];
    for (const [plan, id] of entries) {
      if (id && id === priceId) return plan;
    }
    return null;
  }

  getPlans() {
    const provider = env().BILLING_PROVIDER;
    return {
      provider,
      plans: PLANS.map((plan) => ({
        ...plan,
        paddlePriceId: provider === "paddle" ? this.priceIdFor(plan.id) : null,
      })),
    };
  }

  async getSubscription() {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select({ plan: tenants.plan, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const tenant = rows[0];
    if (!tenant) throw forbidden("no_tenant", "No tenant context for this request");
    const plan = PLANS.find((p) => p.id === tenant.plan) ?? PLANS[0];
    return {
      provider: env().BILLING_PROVIDER,
      plan: plan.id,
      planName: plan.name,
      priceCents: plan.priceCents,
      status: tenant.status === "trial" ? "trialing" : tenant.status,
      limits: plan.limits,
    };
  }

  async startCheckout(plan: TenantPlan) {
    const { tenantId } = this.ctx();
    if (plan === "free") {
      throw apiError(400, "invalid_plan", "Choose a paid plan to upgrade");
    }
    const provider = env().BILLING_PROVIDER;

    if (provider === "stub") {
      await this.applyPlan(tenantId, plan);
      await this.audit.log({
        action: "billing.plan_changed",
        entityType: "tenant",
        entityId: tenantId,
        metadata: { plan, mode: "stub" },
      });
      return { mode: "stub" as const, plan };
    }

    const priceId = this.priceIdFor(plan);
    if (!priceId || !env().PADDLE_API_KEY) {
      throw apiError(503, "billing_not_configured", "Billing is not fully configured");
    }
    const base = env().PADDLE_ENV === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
    let response: Response;
    try {
      response = await fetch(`${base}/transactions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env().PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ price_id: priceId, quantity: 1 }],
          custom_data: { tenant_id: tenantId },
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw apiError(502, "paddle_unreachable", `Paddle could not be reached: ${message}`);
    }
    const payload = (await response.json().catch(() => null)) as {
      data?: { checkout?: { url?: string } };
      error?: { detail?: string };
    } | null;
    if (!response.ok || !payload?.data?.checkout?.url) {
      throw apiError(
        502,
        "paddle_error",
        payload?.error?.detail ?? "Paddle rejected the checkout request",
      );
    }
    return { mode: "paddle" as const, plan, checkoutUrl: payload.data.checkout.url };
  }

  verifyWebhookSignature(rawBody: Buffer | undefined, signatureHeader: string | undefined): void {
    const secret = env().PADDLE_WEBHOOK_SECRET;
    if (!secret) throw apiError(503, "billing_not_configured", "Billing webhook is not configured");
    if (!signatureHeader) throw unauthorized("invalid_signature", "Missing signature header");
    const parts = new Map(
      signatureHeader.split(";").map((part) => {
        const [key, ...rest] = part.split("=");
        return [key.trim(), rest.join("=").trim()];
      }),
    );
    const ts = parts.get("ts");
    const h1 = parts.get("h1");
    if (!ts || !h1 || !rawBody) {
      throw unauthorized("invalid_signature", "Signature header is malformed");
    }
    const expected = createHmac("sha256", secret).update(`${ts}:${rawBody.toString("utf8")}`).digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");
    const providedBuf = Buffer.from(h1, "utf8");
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw unauthorized("invalid_signature", "Signature verification failed");
    }
  }

  async handleWebhook(payload: unknown) {
    const event = payload as {
      event_type?: string;
      data?: {
        custom_data?: { tenant_id?: string } | null;
        status?: string;
        items?: Array<{ price?: { id?: string } }>;
      };
    } | null;
    const eventType = event?.event_type;
    const tenantId = event?.data?.custom_data?.tenant_id ?? null;
    if (!eventType || !tenantId) {
      this.logger.warn(`Ignoring Paddle webhook without event type or tenant: ${eventType ?? "unknown"}`);
      return { received: true, ignored: true };
    }

    const priceId = event?.data?.items?.[0]?.price?.id ?? null;
    const planFromPrice = priceId ? this.planForPriceId(priceId) : null;

    if (eventType === "subscription.canceled" || eventType === "subscription.past_due") {
      if (eventType === "subscription.canceled") {
        await this.applyPlan(tenantId, "free");
      }
      return { received: true };
    }

    if (eventType === "transaction.completed" || eventType === "subscription.updated" || eventType === "subscription.created") {
      if (planFromPrice) {
        await this.applyPlan(tenantId, planFromPrice);
      }
      return { received: true };
    }

    return { received: true, ignored: true };
  }

  async applyPlan(tenantId: string, plan: TenantPlan): Promise<void> {
    await withTenantContext({ isPlatformAdmin: true, platformLogin: true }, async (db) => {
      await db.update(tenants).set({ plan }).where(eq(tenants.id, tenantId));
    });
    this.logger.log(`Tenant ${tenantId} plan set to ${plan}`);
  }
}
