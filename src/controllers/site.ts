import { FastifyReply, FastifyRequest } from "fastify";
import toHttpError from "../utils/toHttpError";
import { prisma } from "../db/client";
import { RateLimiterMemory } from "rate-limiter-flexible";


type ContactBody = {
  name: string;
  email: string;
  mobile: string;
  description: string;
};

export const subscribeLimiter = new RateLimiterMemory({
  keyPrefix: "subscribe",
  points: 5, // 5 requests
  duration: 60, // per 1 minute
});

export const contactLimiter = new RateLimiterMemory({
  keyPrefix: "contact",
  points: 3, // 3 requests
  duration: 60, // per 1 minute
});

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();



export const subscribeEmail = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const ip = req.ip;

    await subscribeLimiter.consume(ip);

    const { email } = req.body as { email: string };

    if (!email) {
      return reply.status(400).send({ message: "Email is required" });
    }

    const now = new Date();

    const existing = await prisma.emailSubscription.findUnique({
      where: { email },
    });

    if (existing) {
      const last = new Date(existing.lastSubmission);

      const isSameDay =
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate();

      if (isSameDay) {
        return reply.status(200).send({
          message: "Subscription updated successfully",
        });
      }

      await prisma.emailSubscription.update({
        where: { email },
        data: { lastSubmission: now },
      });

      return reply.send({ message: "Subscription updated successfully" });
    }

    await prisma.emailSubscription.create({
      data: { email, lastSubmission: now },
    });

    return reply.send({ message: "Subscribed successfully" });
  } catch (e: any) {
    if (e?.remainingPoints === 0) {
      return reply.status(429).send({
        message: "Too many requests. Try again later",
      });
    }

    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const submitContactForm = async (
  req: FastifyRequest<{ Body: ContactBody }>,
  reply: FastifyReply,
) => {
  try {
    await contactLimiter.consume(req.ip);

    const { name, email, mobile, description } = req.body;
    const now = new Date();

    const existing = await prisma.contactSubmissions.findFirst({
      where: {
        OR: [{ email }, { mobile }],
      },
    });

    if (existing) {
      if (isSameDay(new Date(existing.lastSubmission), now)) {
        return reply.status(200).send({
          message: "Contact updated successfully",
        });
      }

      await prisma.contactSubmissions.update({
        where: { id: existing.id },
        data: {
          name,
          email,
          mobile,
          description,
          lastSubmission: now,
        },
      });

      return reply.status(200).send({
        message: "Contact updated successfully",
      });
    }

    await prisma.contactSubmissions.create({
      data: {
        name,
        email,
        mobile,
        description,
        lastSubmission: now,
      },
    });

    return reply.status(200).send({
      message: "Contact submitted successfully",
    });
  } catch (e: any) {
    if (typeof e?.remainingPoints === "number" || typeof e?.msBeforeNext === "number") {
      return reply.status(429).send({
        message: "Too many requests. Try again later",
      });
    }

    return reply.status(500).send({
      message: "Internal server error",
    });
  }
};