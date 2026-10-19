import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { Roles, ZodPipe } from "../../common/decorators";
import { LoansService } from "./loans.service";
import {
  CheckinInput,
  checkinSchema,
  CheckoutInput,
  checkoutSchema,
  listLoansSchema,
} from "./dto";

@Controller("loans")
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Roles("tenant_admin", "librarian", "assistant")
  @Post("checkout")
  checkout(@Body(new ZodPipe(checkoutSchema)) body: CheckoutInput) {
    return this.loans.checkout(body);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Post("checkin")
  @HttpCode(200)
  checkin(@Body(new ZodPipe(checkinSchema)) body: CheckinInput) {
    return this.loans.checkin(body);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get("overdue")
  overdue() {
    return this.loans.overdueSummary();
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get()
  list(@Query(new ZodPipe(listLoansSchema)) query: ReturnType<typeof listLoansSchema.parse>) {
    return this.loans.list(query);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get(":id")
  get(@Param("id") id: string) {
    return this.loans.detail(id);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Post(":id/renew")
  @HttpCode(200)
  renew(@Param("id") id: string) {
    return this.loans.renew(id);
  }

  @Roles("tenant_admin", "librarian")
  @Post(":id/lost")
  @HttpCode(200)
  markLost(@Param("id") id: string) {
    return this.loans.markLost(id);
  }
}
