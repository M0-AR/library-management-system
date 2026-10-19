import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Roles, ZodPipe } from "../../common/decorators";
import {
  BranchesService,
  CreateBranchInput,
  createBranchSchema,
  UpdateBranchInput,
  updateBranchSchema,
} from "./branches.service";

@Controller("branches")
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Roles("tenant_admin", "librarian", "assistant")
  @Get()
  list(@Query("includeInactive") includeInactive?: string) {
    return this.branches.list(includeInactive === "true");
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get(":id")
  get(@Param("id") id: string) {
    return this.branches.get(id);
  }

  @Roles("tenant_admin")
  @Post()
  create(@Body(new ZodPipe(createBranchSchema)) body: CreateBranchInput) {
    return this.branches.create(body);
  }

  @Roles("tenant_admin")
  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodPipe(updateBranchSchema)) body: UpdateBranchInput) {
    return this.branches.update(id, body);
  }
}
