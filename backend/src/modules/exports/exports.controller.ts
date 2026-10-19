import { Controller, Get, Param, StreamableFile } from "@nestjs/common";
import { Roles } from "../../common/decorators";
import { ExportsService } from "./exports.service";

@Controller("exports")
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Roles("tenant_admin", "librarian")
  @Get(":resource")
  async download(@Param("resource") resource: string): Promise<StreamableFile> {
    const { filename, csv } = await this.exports.build(resource);
    return new StreamableFile(Buffer.from(csv, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
