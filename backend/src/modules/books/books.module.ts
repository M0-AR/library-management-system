import { Module } from "@nestjs/common";
import { BooksController, CopiesController } from "./books.controller";
import { BooksService } from "./books.service";

@Module({
  controllers: [BooksController, CopiesController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
