import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

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
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  COLLEGE_NOT_FOUND: "COLLEGE_NOT_FOUND",
  INVALID_SEARCH_FILTERS: "INVALID_SEARCH_FILTERS",
  APPLICATION_NOT_FOUND: "APPLICATION_NOT_FOUND",
  APPLICATION_DEADLINE_PASSED: "APPLICATION_DEADLINE_PASSED",
  MISSING_REQUIRED_DOCUMENTS: "MISSING_REQUIRED_DOCUMENTS",
  DUPLICATE_APPLICATION: "DUPLICATE_APPLICATION",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_DECLINED: "PAYMENT_DECLINED",
  INVALID_PAYMENT_METHOD: "INVALID_PAYMENT_METHOD",
  REFUND_FAILED: "REFUND_FAILED",
  SUBSCRIPTION_ERROR: "SUBSCRIPTION_ERROR",
  THIRD_PARTY_SERVICE_ERROR: "THIRD_PARTY_SERVICE_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  TOKEN_LIMIT_EXCEEDED: "TOKEN_LIMIT_EXCEEDED",
  SMS_SEND_FAILED: "SMS_SEND_FAILED",
  INVALID_OTP: "INVALID_OTP",
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_ATTEMPTS_EXCEEDED: "OTP_ATTEMPTS_EXCEEDED",
  OTP_WINDOW_EXPIRED: "OTP_WINDOW_EXPIRED",
  OTP_LIMIT_EXCEEDED: "OTP_LIMIT_EXCEEDED",
} as const;

export const STATUS_BY_CODE: Record<string, number> = {
  [errorCodes.VALIDATION_ERROR]: 400,
  [errorCodes.INVALID_INPUT]: 400,
  [errorCodes.UNAUTHORIZED]: 401,
  [errorCodes.FORBIDDEN]: 403,
  [errorCodes.NOT_FOUND]: 404,
  [errorCodes.RATE_LIMIT_EXCEEDED]: 429,
  [errorCodes.TOKEN_LIMIT_EXCEEDED]: 429,
  [errorCodes.COLLEGE_NOT_FOUND]: 404,
  [errorCodes.INVALID_SEARCH_FILTERS]: 400,
  [errorCodes.APPLICATION_NOT_FOUND]: 404,
  [errorCodes.APPLICATION_DEADLINE_PASSED]: 409,
  [errorCodes.MISSING_REQUIRED_DOCUMENTS]: 400,
  [errorCodes.DUPLICATE_APPLICATION]: 409,
  [errorCodes.PAYMENT_FAILED]: 402,
  [errorCodes.PAYMENT_DECLINED]: 402,
  [errorCodes.INVALID_PAYMENT_METHOD]: 400,
  [errorCodes.REFUND_FAILED]: 400,
  [errorCodes.SUBSCRIPTION_ERROR]: 400,
  [errorCodes.THIRD_PARTY_SERVICE_ERROR]: 502,
  [errorCodes.SMS_SEND_FAILED]: 502,
  [errorCodes.INVALID_OTP]: 400,
  [errorCodes.OTP_EXPIRED]: 400,
  [errorCodes.OTP_ATTEMPTS_EXCEEDED]: 429,
  [errorCodes.OTP_WINDOW_EXPIRED]: 401,
  [errorCodes.OTP_LIMIT_EXCEEDED]: 429,
};

type HttpErrorPayload = {
  message: string;
  code?: string;
  issues?: unknown;
  debug?: { meta?: unknown; stack?: string };
};

function statusForAppCode(code?: string, fallback = 400): number {
  if (!code) return fallback;
  const mapped = STATUS_BY_CODE[code];
  return Number.isInteger(mapped) ? mapped : fallback;
}

export default function toHttpError(e: unknown): {
  status: number;
  payload: HttpErrorPayload;
} {
  const isProd = process.env.NODE_ENV === "production";
  const anyErr = e as any;

  if (e instanceof AppError) {
    const status = Number.isInteger(e.statusCode)
      ? e.statusCode
      : statusForAppCode(e.code, 400);

    return {
      status,
      payload: {
        message: e.message || "Application error",
        code: e.code,
        ...(isProd ? {} : { debug: { stack: e.stack } }),
      },
    };
  }

  if (
    anyErr?.code &&
    typeof anyErr.code === "string" &&
    STATUS_BY_CODE[anyErr.code]
  ) {
    const status = statusForAppCode(anyErr.code, 400);
    return {
      status,
      payload: {
        message: anyErr.message ?? "Application error",
        code: anyErr.code,
        ...(isProd ? {} : { debug: { stack: anyErr.stack } }),
      },
    };
  }

  if (e instanceof ZodError) {
    return {
      status: 422,
      payload: {
        message: "Validation failed",
        code: errorCodes.VALIDATION_ERROR,
        issues: e.issues,
        ...(isProd ? {} : { debug: { stack: e.stack } }),
      },
    };
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = e.meta;
    const base = {
      code: e.code,
      ...(isProd ? {} : { debug: { meta, stack: e.stack } }),
    };

    switch (e.code) {
      case "P2002":
        return {
          status: 409,
          payload: {
            message: "Already exists",
            ...base,
          },
        };
      case "P2025":
        return {
          status: 404,
          payload: {
            message: "Record not found",
            ...base,
          },
        };
      case "P2003":
        return {
          status: 400,
          payload: {
            message: "Invalid request",
            ...base,
          },
        };
      case "P2000":
        return {
          status: 400,
          payload: {
            message: "Value too long",
            ...base,
          },
        };
      case "P2024":
        return {
          status: 503,
          payload: {
            message: "Database timeout",
            ...base,
          },
        };
      default:
        return {
          status: 500,
          payload: {
            message: "Internal server error",
            ...base,
          },
        };
    }
  }

  if (e instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 400,
      payload: {
        message: "Invalid query or data for Prisma operation",
        code: "PRISMA_VALIDATION",
        ...(isProd ? {} : { debug: { stack: e.stack } }),
      },
    };
  }

  if (e instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      payload: {
        message: "Database initialization error",
        code: "PRISMA_INIT",
        ...(isProd ? {} : { debug: { stack: e.stack } }),
      },
    };
  }

  if (anyErr?.code && typeof anyErr.code === "string") {
    const code = anyErr.code as string;
    const base = {
      code,
      ...(isProd ? {} : { debug: { stack: anyErr.stack } }),
    };

    switch (code) {
      case "23505":
        return {
          status: 409,
          payload: {
            message: "Duplicate value violates unique constraint",
            ...base,
          },
        };
      case "23503":
        return {
          status: 400,
          payload: {
            message: "Referenced record does not exist",
            ...base,
          },
        };
      case "23502":
        return {
          status: 400,
          payload: {
            message: "Required field missing",
            ...base,
          },
        };
      case "22P02":
        return {
          status: 400,
          payload: {
            message: "Invalid input syntax",
            ...base,
          },
        };
      case "22001":
        return {
          status: 400,
          payload: {
            message: "Value too long",
            ...base,
          },
        };
      case "22003":
        return {
          status: 400,
          payload: {
            message: "Numeric value out of range",
            ...base,
          },
        };
      default:
        if (code.startsWith("08")) {
          return {
            status: 503,
            payload: {
              message: "Database connection error",
              ...base,
            },
          };
        }
    }
  }

  if (anyErr?.isBoom && anyErr.output?.statusCode) {
    return {
      status: anyErr.output.statusCode,
      payload: {
        message: anyErr.message || "Request failed",
        code: "BOOM_ERROR",
      },
    };
  }

  if (Number.isInteger(anyErr?.statusCode)) {
    const maybeCode =
      typeof anyErr?.code === "string" ? anyErr.code : undefined;

    return {
      status:
        maybeCode && STATUS_BY_CODE[maybeCode]
          ? STATUS_BY_CODE[maybeCode]
          : anyErr.statusCode,
      payload: {
        message: anyErr.message ?? "Error",
        code: maybeCode,
      },
    };
  }

  if (Number.isInteger(anyErr?.status)) {
    const maybeCode =
      typeof anyErr?.code === "string" ? anyErr.code : undefined;

    return {
      status:
        maybeCode && STATUS_BY_CODE[maybeCode]
          ? STATUS_BY_CODE[maybeCode]
          : anyErr.status,
      payload: {
        message: anyErr.message ?? "Error",
        code: maybeCode,
      },
    };
  }

  return {
    status: 500,
    payload: {
      message: "Internal Server Error",
      ...(isProd ? {} : { debug: { stack: anyErr?.stack } }),
    },
  };
}