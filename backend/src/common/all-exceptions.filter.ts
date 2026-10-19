import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
interface ReplyLike {
  status(code: number): ReplyLike;
  send(payload: unknown): unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<ReplyLike>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      error: { code: "internal_error", message: "An unexpected error occurred" },
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === "object" && response !== null && "error" in response) {
        body = response as Record<string, unknown>;
      } else if (typeof response === "object" && response !== null) {
        const message = (response as Record<string, unknown>).message;
        body = {
          error: {
            code: status === 400 ? "bad_request" : `http_${status}`,
            message: Array.isArray(message) ? message.join(", ") : String(message ?? exception.message),
          },
        };
      } else {
        body = { error: { code: `http_${status}`, message: String(response) } };
      }
    } else {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      const cause = err.cause instanceof Error ? ` [cause: ${err.cause.message}]` : "";
      this.logger.error(
        `Unhandled error on ${request?.method} ${request?.url}: ${err.message}${cause}`,
        err.stack,
      );
    }

    if (status >= 500) {
      this.logger.error(
        `${request?.method} ${request?.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    reply.status(status).send(body);
  }
}
