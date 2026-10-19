import { Body, Controller, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { Roles, ZodPipe } from "../../common/decorators";
import { MeService } from "./me.service";
import { PlaceMeHoldInput, placeMeHoldSchema, UpdateProfileInput, updateProfileSchema } from "./dto";

@Roles("patron")
@Controller("me")
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  profile() {
    return this.me.profile();
  }

  @Patch()
  update(@Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput) {
    return this.me.updateProfile(body);
  }

  @Get("loans")
  loans() {
    return this.me.activeLoans();
  }

  @Get("loans/history")
  history() {
    return this.me.loanHistory();
  }

  @Post("loans/:id/renew")
  @HttpCode(200)
  renew(@Param("id") id: string) {
    return this.me.renewLoan(id);
  }

  @Get("holds")
  holds() {
    return this.me.openHolds();
  }

  @Post("holds")
  placeHold(@Body(new ZodPipe(placeMeHoldSchema)) body: PlaceMeHoldInput) {
    return this.me.placeHold(body.bookId);
  }

  @Post("holds/:id/cancel")
  @HttpCode(200)
  cancelHold(@Param("id") id: string) {
    return this.me.cancelHold(id);
  }

  @Get("fines")
  fines() {
    return this.me.myFines();
  }
}
