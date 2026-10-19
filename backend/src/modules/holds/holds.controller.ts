import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { Roles, ZodPipe } from "../../common/decorators";
import { HoldsService } from "./holds.service";
import { listHoldsSchema, PlaceHoldInput, placeHoldSchema } from "./dto";

@Controller("holds")
export class HoldsController {
  constructor(private readonly holds: HoldsService) {}

  @Roles("tenant_admin", "librarian", "assistant")
  @Get()
  list(@Query(new ZodPipe(listHoldsSchema)) query: ReturnType<typeof listHoldsSchema.parse>) {
    return this.holds.list(query);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Post()
  place(@Body(new ZodPipe(placeHoldSchema)) body: PlaceHoldInput) {
    return this.holds.place(body);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get(":id")
  get(@Param("id") id: string) {
    return this.holds.getOne(id);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@Param("id") id: string) {
    return this.holds.cancel(id);
  }
}
