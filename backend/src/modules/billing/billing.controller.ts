import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { Public, RateLimit, Roles, ZodPipe } from "../../common/decorators";
import { BillingService } from "./billing.service";
import { CheckoutPlanInput, checkoutPlanSchema } from "./dto";

interface RawBillingRequest {
  rawBody?: Buffer;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Roles("tenant_admin")
  @Get("plans")
  plans() {
    return this.billing.getPlans();
  }

  @Roles("tenant_admin")
  @Get("subscription")
  subscription() {
    return this.billing.getSubscription();
  }

  @Roles("tenant_admin")
  @Post("checkout")
  @HttpCode(200)
  checkout(@Body(new ZodPipe(checkoutPlanSchema)) body: CheckoutPlanInput) {
    return this.billing.startCheckout(body.plan);
  }

  @Public()
  @RateLimit({ limit: 120, windowSec: 60, scope: "ip" })
  @Post("webhook")
  @HttpCode(200)
  webhook(@Req() request: RawBillingRequest) {
    const rawBody =
      request.rawBody ??
      (request.body !== undefined ? Buffer.from(JSON.stringify(request.body), "utf8") : undefined);
    const signature = request.headers["paddle-signature"];
    const signatureHeader = Array.isArray(signature) ? signature[0] : signature;
    this.billing.verifyWebhookSignature(rawBody, signatureHeader);
    return this.billing.handleWebhook(request.body);
  }
}
