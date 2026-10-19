import { HttpException, HttpStatus } from "@nestjs/common";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function apiError(
  status: HttpStatus,
  code: string,
  message: string,
  details?: unknown,
): HttpException {
  const body: ApiErrorBody = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return new HttpException(body, status);
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  apiError(HttpStatus.BAD_REQUEST, code, message, details);

export const unauthorized = (code = "unauthorized", message = "Authentication required") =>
  apiError(HttpStatus.UNAUTHORIZED, code, message);

export const forbidden = (code = "forbidden", message = "You do not have permission to do that") =>
  apiError(HttpStatus.FORBIDDEN, code, message);

export const notFound = (code = "not_found", message = "Resource not found") =>
  apiError(HttpStatus.NOT_FOUND, code, message);

export const conflict = (code: string, message: string) =>
  apiError(HttpStatus.CONFLICT, code, message);

export const tooManyRequests = (code = "rate_limited", message = "Too many requests") =>
  apiError(HttpStatus.TOO_MANY_REQUESTS, code, message);

export const paymentRequired = (code: string, message: string) =>
  apiError(HttpStatus.PAYMENT_REQUIRED, code, message);
