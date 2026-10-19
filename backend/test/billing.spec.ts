import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { api, login, registerTenant, resetDb, setupLibrary } from "./helpers";
import type { TenantSession } from "./helpers";

describe("billing", () => {
  let session: TenantSession;

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;
  });

  it("lists plans and the current subscription", async () => {
    const plans = await (await api()).get("/api/v1/billing/plans").set(session.headers);
    expect(plans.status).toBe(200);
    expect(plans.body.provider).toBe("stub");
    expect(plans.body.plans.map((p: { id: string }) => p.id)).toEqual([
      "free",
      "starter",
      "growth",
      "enterprise",
    ]);
    const growth = plans.body.plans.find((p: { id: string }) => p.id === "growth");
    expect(growth.priceCents).toBe(7900);
    expect(growth.limits.branches).toBe(10);

    const subscription = await (await api())
      .get("/api/v1/billing/subscription")
      .set(session.headers);
    expect(subscription.status).toBe(200);
    expect(subscription.body.plan).toBe("free");
    expect(subscription.body.priceCents).toBe(0);
    expect(["trialing", "active"]).toContain(subscription.body.status);

    const created = await (await api())
      .post("/api/v1/users")
      .set(session.headers)
      .send({
        email: "librarian@test.dev",
        name: "Billing Librarian",
        password: "Password123!",
        role: "librarian",
      });
    expect(created.status).toBe(201);
    const staff = await login(session.slug, "librarian@test.dev", "Password123!");
    const denied = await (await api())
      .get("/api/v1/billing/plans")
      .set("Authorization", `Bearer ${staff.body.accessToken as string}`);
    expect(denied.status).toBe(403);
  });

  it("applies upgrades immediately in stub mode", async () => {
    const checkout = await (await api())
      .post("/api/v1/billing/checkout")
      .set(session.headers)
      .send({ plan: "growth" });
    expect(checkout.status, JSON.stringify(checkout.body)).toBe(200);
    expect(checkout.body.mode).toBe("stub");
    expect(checkout.body.plan).toBe("growth");

    const subscription = await (await api())
      .get("/api/v1/billing/subscription")
      .set(session.headers);
    expect(subscription.body.plan).toBe("growth");
    expect(subscription.body.priceCents).toBe(7900);

    const tenant = await (await api()).get("/api/v1/tenants/me").set(session.headers);
    expect(tenant.body.plan).toBe("growth");

    const free = await (await api())
      .post("/api/v1/billing/checkout")
      .set(session.headers)
      .send({ plan: "free" });
    expect(free.status).toBe(400);
    expect(free.body.error.code).toBe("validation_failed");

    const bogus = await (await api())
      .post("/api/v1/billing/checkout")
      .set(session.headers)
      .send({ plan: "platinum" });
    expect(bogus.status).toBe(400);
  });

  it("verifies webhook signatures and applies lifecycle events", async () => {
    const secret = process.env.PADDLE_WEBHOOK_SECRET as string;

    function signed(payloadObj: Record<string, unknown>) {
      const raw = JSON.stringify(payloadObj);
      const ts = Math.floor(Date.now() / 1000).toString();
      const h1 = createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex");
      return { raw, header: `ts=${ts};h1=${h1}` };
    }

    const noSignature = await (await api())
      .post("/api/v1/billing/webhook")
      .send({ event_type: "subscription.canceled" });
    expect(noSignature.status).toBe(401);
    expect(noSignature.body.error.code).toBe("invalid_signature");

    const malformed = await (await api())
      .post("/api/v1/billing/webhook")
      .set("paddle-signature", "ts=123")
      .send({ event_type: "subscription.canceled" });
    expect(malformed.status).toBe(401);

    const forgedBody = signed({ event_type: "subscription.canceled" });
    const forgedH1 = createHmac("sha256", "wrong-secret")
      .update(`${forgedBody.header.split(";")[0].split("=")[1]}:${forgedBody.raw}`)
      .digest("hex");
    const forged = await (await api())
      .post("/api/v1/billing/webhook")
      .set("Content-Type", "application/json")
      .set("paddle-signature", `ts=${forgedBody.header.split(";")[0].split("=")[1]};h1=${forgedH1}`)
      .send(forgedBody.raw);
    expect(forged.status).toBe(401);
    expect(forged.body.error.code).toBe("invalid_signature");

    const missingTenant = signed({ event_type: "subscription.updated" });
    const ignored = await (await api())
      .post("/api/v1/billing/webhook")
      .set("Content-Type", "application/json")
      .set("paddle-signature", missingTenant.header)
      .send(missingTenant.raw);
    expect(ignored.status).toBe(200);
    expect(ignored.body.ignored).toBe(true);

    const upgrade = await (await api())
      .post("/api/v1/billing/checkout")
      .set(session.headers)
      .send({ plan: "starter" });
    expect(upgrade.status).toBe(200);

    const cancelPayload = signed({
      event_type: "subscription.canceled",
      data: { custom_data: { tenant_id: session.tenantId } },
    });
    const cancel = await (await api())
      .post("/api/v1/billing/webhook")
      .set("Content-Type", "application/json")
      .set("paddle-signature", cancelPayload.header)
      .send(cancelPayload.raw);
    expect(cancel.status, JSON.stringify(cancel.body)).toBe(200);
    expect(cancel.body.received).toBe(true);

    const subscription = await (await api())
      .get("/api/v1/billing/subscription")
      .set(session.headers);
    expect(subscription.body.plan).toBe("free");

    const other = await registerTenant();
    const otherSubscription = await (await api())
      .get("/api/v1/billing/subscription")
      .set(other.headers);
    expect(otherSubscription.body.plan).toBe("free");
  });
});
