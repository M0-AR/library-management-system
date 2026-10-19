import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { Roles, ZodPipe } from "../../common/decorators";
import { MembersService } from "./members.service";
import {
  CreateMemberInput,
  createMemberSchema,
  listMembersSchema,
  UpdateMemberInput,
  updateMemberSchema,
} from "./dto";

@Controller("members")
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Roles("tenant_admin", "librarian", "assistant")
  @Get()
  list(@Query(new ZodPipe(listMembersSchema)) query: ReturnType<typeof listMembersSchema.parse>) {
    return this.members.list(query);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get("stats")
  stats() {
    return this.members.stats();
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get("card/:cardNumber")
  findByCard(@Param("cardNumber") cardNumber: string) {
    return this.members.findByCard(cardNumber);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get(":id")
  get(@Param("id") id: string) {
    return this.members.get(id);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Post()
  create(@Body(new ZodPipe(createMemberSchema)) body: CreateMemberInput) {
    return this.members.create(body);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodPipe(updateMemberSchema)) body: UpdateMemberInput) {
    return this.members.update(id, body);
  }

  @Roles("tenant_admin", "librarian")
  @Delete(":id")
  @HttpCode(204)
  async close(@Param("id") id: string): Promise<void> {
    await this.members.close(id);
  }
}
