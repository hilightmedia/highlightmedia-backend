import type { RouteShorthandOptions } from "fastify";

const messageResponse = {
  type: "object",
  additionalProperties: false,
  required: ["message"],
  properties: {
    message: { type: "string" },
  },
};

export const sendOtpSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Auth"],
    body: {
      type: "object",
      additionalProperties: false,
      required: ["email"],
      properties: {
        email: { type: "string", format: "email", maxLength: 60 },
      },
    },
    response: {
      200: messageResponse,
      400: messageResponse,
      404: messageResponse,
      429: messageResponse,
    },
  },
};

export const resendOtpSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Auth"],
    body: {
      type: "object",
      additionalProperties: false,
      required: ["email"],
      properties: {
        email: { type: "string", format: "email", maxLength: 60 },
      },
    },
    response: {
      200: messageResponse,
      400: messageResponse,
      404: messageResponse,
      429: messageResponse,
    },
  },
};

export const verifyOtpSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Auth"],
    body: {
      type: "object",
      additionalProperties: false,
      required: ["email", "otp"],
      properties: {
        email: { type: "string", format: "email", maxLength: 60 },
        otp: {
          type: "string",
          minLength: 6,
          maxLength: 6,
          pattern: "^[0-9]{6}$",
        },
      },
    },
    response: {
      200: messageResponse,
      400: messageResponse,
      404: messageResponse,
      429: messageResponse,
    },
  },
};

export const setNewPasswordSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Auth"],
    body: {
      type: "object",
      additionalProperties: false,
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email", maxLength: 60 },
        password: { type: "string", minLength: 8, maxLength: 255 },
      },
    },
    response: {
      200: messageResponse,
      400: messageResponse,
      404: messageResponse,
      429: messageResponse,
    },
  },
};