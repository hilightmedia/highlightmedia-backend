import { FastifyInstance } from "fastify";
import { createAdminUser, loginAdminUser, refreshToken } from "../controllers/auth";

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    "/create-admin-user",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "name", "password"],
          properties: {
            email: { type: "string", format: "email" },
            name: { type: "string", minLength: 3 , maxLength: 50},
            password: { type: "string", minLength: 8, maxLength: 16 },
          },
        },
      },
    },
    createAdminUser
  );

  app.post("/login", {
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8, maxLength: 16 },
        },
      },
    }
  }, loginAdminUser);

  app.post("/refresh-token", refreshToken);
}
