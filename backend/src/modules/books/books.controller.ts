import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Roles, ZodPipe } from "../../common/decorators";
import { BooksService } from "./books.service";
import {
  CreateBookInput,
  createBookSchema,
  CreateCopiesInput,
  createCopiesSchema,
  isbnParamSchema,
  listBooksSchema,
  UpdateBookInput,
  updateBookSchema,
  UpdateCopyInput,
  updateCopySchema,
} from "./dto";
import { z } from "zod";

const statusSchema = z.object({ status: z.enum(["active", "archived"]) });
const idParamSchema = z.object({ id: z.uuid() });

@Controller("books")
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Roles("tenant_admin", "librarian", "assistant")
  @Get()
  list(@Query(new ZodPipe(listBooksSchema)) query: ReturnType<typeof listBooksSchema.parse>) {
    return this.books.list(query);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get("categories")
  categories() {
    return this.books.categories();
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get("search")
  search(@Query("q") q: string, @Query("limit") limit?: string) {
    return this.books.searchTitles(q ?? "", Number(limit ?? 10));
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get("isbn/:isbn")
  lookupIsbn(@Param(new ZodPipe(isbnParamSchema)) params: { isbn: string }) {
    return this.books.lookupIsbn(params.isbn);
  }

  @Roles("tenant_admin", "librarian")
  @Post()
  create(@Body(new ZodPipe(createBookSchema)) body: CreateBookInput) {
    return this.books.create(body);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get(":id")
  get(@Param(new ZodPipe(idParamSchema)) params: { id: string }) {
    return this.books.get(params.id);
  }

  @Roles("tenant_admin", "librarian")
  @Patch(":id")
  update(
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @Body(new ZodPipe(updateBookSchema)) body: UpdateBookInput,
  ) {
    return this.books.update(params.id, body);
  }

  @Roles("tenant_admin", "librarian")
  @Post(":id/status")
  setStatus(
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @Body(new ZodPipe(statusSchema)) body: { status: "active" | "archived" },
  ) {
    return this.books.setStatus(params.id, body.status);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get(":id/copies")
  listCopies(@Param(new ZodPipe(idParamSchema)) params: { id: string }) {
    return this.books.listCopies(params.id);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Post(":id/copies")
  createCopies(
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @Body(new ZodPipe(createCopiesSchema)) body: CreateCopiesInput,
  ) {
    return this.books.createCopies(params.id, body);
  }
}

@Controller("copies")
export class CopiesController {
  constructor(private readonly books: BooksService) {}

  @Roles("tenant_admin", "librarian", "assistant")
  @Patch(":id")
  update(
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @Body(new ZodPipe(updateCopySchema)) body: UpdateCopyInput,
  ) {
    return this.books.updateCopy(params.id, body);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Delete(":id")
  @HttpCode(204)
  async withdraw(@Param(new ZodPipe(idParamSchema)) params: { id: string }): Promise<void> {
    await this.books.withdrawCopy(params.id);
  }
}
