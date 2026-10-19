import { Controller, Get, Param, Query } from "@nestjs/common";
import { Public, RateLimit, ZodPipe } from "../../common/decorators";
import { PublicService } from "./public.service";
import { domainQuerySchema, publicBooksQuerySchema } from "./dto";
import type { PublicBooksQuery } from "./dto";

@Public()
@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get("tenants/:slug")
  tenant(@Param("slug") slug: string) {
    return this.publicService.tenantBySlug(slug);
  }

  @Get("tenants/:slug/books")
  catalog(@Param("slug") slug: string, @Query(new ZodPipe(publicBooksQuerySchema)) query: PublicBooksQuery) {
    return this.publicService.catalog(slug, query);
  }

  @Get("tenants/:slug/categories")
  categories(@Param("slug") slug: string) {
    return this.publicService.categories(slug);
  }

  @Get("tenants/:slug/books/:bookId")
  book(@Param("slug") slug: string, @Param("bookId") bookId: string) {
    return this.publicService.bookDetail(slug, bookId);
  }

  @RateLimit({ limit: 1200, windowSec: 60, scope: "ip" })
  @Get("domains/allow")
  domainAllow(@Query(new ZodPipe(domainQuerySchema)) query: { domain: string }) {
    return this.publicService.domainAllowed(query.domain);
  }

  @RateLimit({ limit: 600, windowSec: 60, scope: "ip" })
  @Get("domains/resolve")
  domainResolve(@Query(new ZodPipe(domainQuerySchema)) query: { domain: string }) {
    return this.publicService.resolveDomain(query.domain);
  }
}
