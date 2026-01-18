import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const {
  JWT_ACCESS_SECRET: ACCESS_SECRET,
  JWT_REFRESH_SECRET: REFRESH_SECRET,
  JWT_ACCESS_TTL: ACCESS_TTL,
  JWT_REFRESH_TTL: REFRESH_TTL,
} = env;

type SignOptions = { expiresIn?: string | number; subject?: string };

export type JwtPayload = {
  id: number;
  name: string;
  email: string;
};

export type TokenError = {
  expired: boolean;
  malformed: boolean;
  message: string;
};

export const JwtService = {
  signAccess(payload: Omit<JwtPayload, "type">, opts: SignOptions = {}) {
    return jwt.sign({ ...payload, type: "access" }, ACCESS_SECRET, {
      expiresIn: ACCESS_TTL,
      ...opts,
    } as jwt.SignOptions);
  },
  signRefresh(payload: Omit<JwtPayload, "type">, opts: SignOptions = {}) {
    return jwt.sign({ ...payload, type: "refresh" }, REFRESH_SECRET, {
      expiresIn: REFRESH_TTL,
      ...opts,
    } as jwt.SignOptions);
  },
  verifyAccess<T extends object = any>(token: string): JwtPayload & T {
    return jwt.verify(token, ACCESS_SECRET) as any;
  },
  verifyRefresh<T extends object = any>(token: string): JwtPayload & T {
    return jwt.verify(token, REFRESH_SECRET) as any;
  },
  parseTokenError(error: any): TokenError {
    if (!error) {
      return { expired: false, malformed: false, message: "Unknown error" };
    }

    const errorName = error.name || "";
    const errorMessage = error.message || "";

    // TokenExpiredError -> token is expired (can be refreshed)
    if (errorName === "TokenExpiredError") {
      return { expired: true, malformed: false, message: "Token expired" };
    }

    // JsonWebTokenError, NotBeforeError -> token is malformed/invalid (must logout)
    if (
      errorName === "JsonWebTokenError" ||
      errorName === "NotBeforeError" ||
      errorName === "SyntaxError"
    ) {
      return {
        expired: false,
        malformed: true,
        message: errorMessage || "Invalid token",
      };
    }

    return {
      expired: false,
      malformed: true,
      message: errorMessage || "Token verification failed",
    };
  },
};
