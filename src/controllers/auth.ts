import toHttpError from "../utils/toHttpError";
import HttpError from "../utils/httpError";
import { prisma } from "../db/client";
import { JwtService } from "../services/jwt";
import { FastifyReply, FastifyRequest } from "fastify";
import { compareValue, hashValue } from "../services/bycrypt";

export async function createAdminUser(
  req: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { email, name, password } = req.body as {
      email: string;
      name: string;
      password: string;
    };

    const hashPassword = await hashValue(password);

    await prisma.AdminUser.create({
      data: {
        email,
        name,
        password: hashPassword,
      },
    });

    return reply
      .status(200)
      .send({ message: "Admin User created successfully" });
  } catch (e: any) {
    console.log("Sign Up error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
}

export async function loginAdminUser(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await prisma.AdminUser.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      throw new HttpError("Invalid email or password", 400);
    }

    const comparePassword = await compareValue(password, user.password);

    if (!comparePassword) {
      throw new HttpError("Invalid email or password", 400);
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
    };
    const accessToken = JwtService.signAccess(payload);
    const refreshToken = JwtService.signRefresh(payload);

    return reply.status(200).send({
      message: "Admin User logged in successfully",
      accessToken,
      refreshToken,
      user: payload,
    });

  } catch (e: any) {
    console.log("Sign Up error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
}
