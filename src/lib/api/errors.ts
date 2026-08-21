/**
 * Standard API error model. Every thrown `ApiError` becomes the same JSON shape:
 *   { ok: false, error: { code, message, details? }, status }
 */

export type ErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INSUFFICIENT_CREDITS"
  | "OUT_OF_STOCK"
  | "PAYMENT_REQUIRED"
  | "PROVIDER_ERROR"
  | "INTERNAL";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status ?? defaultStatus(code);
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError("INVALID_INPUT", message, 400, details);
  }
  static unauthorized(message = "نیاز به ورود") {
    return new ApiError("UNAUTHORIZED", message, 401);
  }
  static forbidden(message = "عدم دسترسی") {
    return new ApiError("FORBIDDEN", message, 403);
  }
  static notFound(message = "یافت نشد") {
    return new ApiError("NOT_FOUND", message, 404);
  }
  static conflict(message: string) {
    return new ApiError("CONFLICT", message, 409);
  }
  static rateLimited(message = "درخواست زیاد است، کمی بعد تلاش کن") {
    return new ApiError("RATE_LIMITED", message, 429);
  }
}

function defaultStatus(code: ErrorCode): number {
  switch (code) {
    case "INVALID_INPUT":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "INSUFFICIENT_CREDITS":
    case "PAYMENT_REQUIRED":
    case "OUT_OF_STOCK":
      return 422;
    case "PROVIDER_ERROR":
    case "INTERNAL":
    default:
      return 500;
  }
}
