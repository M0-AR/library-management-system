import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { Roles, ZodPipe } from "../../common/decorators";
import { FinesService } from "./fines.service";
import {
  CreateFineInput,
  createFineSchema,
  FineActionInput,
  fineActionSchema,
  listFinesSchema,
} from "./dto";

@Controller("fines")
export class FinesController {
  constructor(private readonly fines: FinesService) {}

  @Roles("tenant_admin", "librarian", "assistant")
  @Get()
  list(@Query(new ZodPipe(listFinesSchema)) query: ReturnType<typeof listFinesSchema.parse>) {
    return this.fines.list(query);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get("summary")
  summary() {
    return this.fines.summary();
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Post()
  create(@Body(new ZodPipe(createFineSchema)) body: CreateFineInput) {
    return this.fines.create(body);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get(":id")
  get(@Param("id") id: string) {
    return this.fines.getOne(id);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Post(":id/pay")
  @HttpCode(200)
  pay(@Param("id") id: string, @Body(new ZodPipe(fineActionSchema)) body: FineActionInput) {
    return this.fines.pay(id, body);
  }

  @Roles("tenant_admin", "librarian")
  @Post(":id/waive")
  @HttpCode(200)
  waive(@Param("id") id: string, @Body(new ZodPipe(fineActionSchema)) body: FineActionInput) {
    return this.fines.waive(id, body);
  }
}
