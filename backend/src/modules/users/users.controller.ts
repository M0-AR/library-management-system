import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { Roles, ZodPipe } from "../../common/decorators";
import { UsersService } from "./users.service";
import {
  CreateUserInput,
  createUserSchema,
  listUsersSchema,
  resetPasswordSchema,
  UpdateUserInput,
  updateUserSchema,
} from "./dto";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles("tenant_admin", "librarian")
  @Get()
  list(@Query(new ZodPipe(listUsersSchema)) query: ReturnType<typeof listUsersSchema.parse>) {
    return this.users.list(query);
  }

  @Roles("tenant_admin", "librarian")
  @Get(":id")
  get(@Param("id") id: string) {
    return this.users.get(id);
  }

  @Roles("tenant_admin")
  @Post()
  create(@Body(new ZodPipe(createUserSchema)) body: CreateUserInput) {
    return this.users.create(body);
  }

  @Roles("tenant_admin")
  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodPipe(updateUserSchema)) body: UpdateUserInput) {
    return this.users.update(id, body);
  }

  @Roles("tenant_admin")
  @Post(":id/reset-password")
  @HttpCode(204)
  async resetPassword(
    @Param("id") id: string,
    @Body(new ZodPipe(resetPasswordSchema)) body: { newPassword: string },
  ): Promise<void> {
    await this.users.resetPassword(id, body.newPassword);
  }

  @Roles("tenant_admin")
  @Delete(":id")
  @HttpCode(204)
  async disable(@Param("id") id: string): Promise<void> {
    await this.users.disable(id);
  }
}
