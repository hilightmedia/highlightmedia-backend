import { FastifyInstance } from "fastify";
import { submitContactForm, subscribeEmail } from "../controllers/site";

export const contactSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "email", "mobile", "description"],
    properties: {
      name: {
        type: "string",
        minLength: 2,
        maxLength: 100,
      },
      email: {
        type: "string",
        format: "email",
        maxLength: 60,
      },
      mobile: {
        type: "string",
        minLength: 10,
        maxLength: 15,
      },
      description: {
        type: "string",
        minLength: 5,
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
    },
  },
};


export default async function SiteRoutes(app: FastifyInstance) {
  app.post("/subscribe", subscribeEmail);
  app.post("/contact",{ schema: contactSchema }, submitContactForm);
}
