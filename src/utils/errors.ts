import { INVALID } from "zod";

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorCodes = {
  // General / Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",

  // College Search
  COLLEGE_NOT_FOUND: "COLLEGE_NOT_FOUND",
  INVALID_SEARCH_FILTERS: "INVALID_SEARCH_FILTERS",

  // Application / Submission
  APPLICATION_NOT_FOUND: "APPLICATION_NOT_FOUND",
  APPLICATION_DEADLINE_PASSED: "APPLICATION_DEADLINE_PASSED",
  MISSING_REQUIRED_DOCUMENTS: "MISSING_REQUIRED_DOCUMENTS",
  DUPLICATE_APPLICATION: "DUPLICATE_APPLICATION",
  USER_NOT_FOUND: "USER_NOT_FOUND",

  // Payment / Billing
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_DECLINED: "PAYMENT_DECLINED",
  INVALID_PAYMENT_METHOD: "INVALID_PAYMENT_METHOD",
  REFUND_FAILED: "REFUND_FAILED",
  SUBSCRIPTION_ERROR: "SUBSCRIPTION_ERROR",

  // External Services
  THIRD_PARTY_SERVICE_ERROR: "THIRD_PARTY_SERVICE_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  TOKEN_LIMIT_EXCEEDED: "TOKEN_LIMIT_EXCEEDED",

  //OTP related
  SMS_SEND_FAILED: "SMS_SEND_FAILED",
  INVALID_OTP: "INVALID_OTP",
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_ATTEMPTS_EXCEEDED: "OTP_ATTEMPTS_EXCEEDED",
  OTP_WINDOW_EXPIRED: "OTP_WINDOW_EXPIRED",
  OTP_LIMIT_EXCEEDED: "OTP_LIMIT_EXCEEDED",
} as const;

// ──────────────────────────────────────────────
// Map error codes to HTTP status (fallbacks)
export const STATUS_BY_CODE: Record<string, number> = {
  // General
  [errorCodes.VALIDATION_ERROR]: 400,
  [errorCodes.INVALID_INPUT]: 400,
  [errorCodes.UNAUTHORIZED]: 401,
  [errorCodes.FORBIDDEN]: 403,
  [errorCodes.NOT_FOUND]: 404,
  [errorCodes.RATE_LIMIT_EXCEEDED]: 429,
  [errorCodes.TOKEN_LIMIT_EXCEEDED]: 429,

  // Search
  [errorCodes.COLLEGE_NOT_FOUND]: 404,
  [errorCodes.INVALID_SEARCH_FILTERS]: 400,

  // Applications
  [errorCodes.APPLICATION_NOT_FOUND]: 404,
  [errorCodes.APPLICATION_DEADLINE_PASSED]: 409,
  [errorCodes.MISSING_REQUIRED_DOCUMENTS]: 400,
  [errorCodes.DUPLICATE_APPLICATION]: 409,

  // Payments
  [errorCodes.PAYMENT_FAILED]: 402,
  [errorCodes.PAYMENT_DECLINED]: 402,
  [errorCodes.INVALID_PAYMENT_METHOD]: 400,
  [errorCodes.REFUND_FAILED]: 400,
  [errorCodes.SUBSCRIPTION_ERROR]: 400,

  // External
  [errorCodes.THIRD_PARTY_SERVICE_ERROR]: 502,

  // OTP
  [errorCodes.SMS_SEND_FAILED]: 502,
  [errorCodes.INVALID_OTP]: 400,
  [errorCodes.OTP_EXPIRED]: 400,
  [errorCodes.OTP_ATTEMPTS_EXCEEDED]: 429,
  [errorCodes.OTP_WINDOW_EXPIRED]: 401,
  [errorCodes.OTP_LIMIT_EXCEEDED]: 429,
};

export type ErrorCodes = (typeof errorCodes)[keyof typeof errorCodes];
