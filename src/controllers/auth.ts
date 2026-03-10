import toHttpError from "../utils/toHttpError";
import HttpError from "../utils/httpError";
import { prisma } from "../db/client";
import { JwtService } from "../services/jwt";
import { FastifyReply, FastifyRequest } from "fastify";
import { compareValue, hashValue } from "../services/bycrypt";
import { OtpService } from "../services/otp";

export async function createAdminUser(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { email, name, password } = req.body as {
      email: string;
      name: string;
      password: string;
    };

    const hashPassword = await hashValue(password);

    await prisma.adminUser.create({
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
    const user = await prisma.adminUser.findUnique({
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

export const refreshToken = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const payloadData = JwtService.verifyRefresh(refreshToken);
    const payload = {
      id: payloadData.id,
      name: payloadData.name,
      email: payloadData.email,
    };
    console.log("Refresh token payload: ", payload);
    const accessToken = JwtService.signAccess(payload);
    return reply.status(200).send({ accessToken });
  } catch (e: any) {
    console.log("Refresh token error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export async function sendOtp(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { email } = req.body as { email: string };

    const user = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const otp = OtpService.generate();
    const otpExpiresAt = OtpService.getExpiry(5);
    const otpResendAvailableAt = OtpService.getResendWindow(60);

    await prisma.adminUser.update({
      where: { email },
      data: {
        otp,
        otpExpiresAt,
        otpVerified: false,
        otpResendAvailableAt,
      },
    });

    await OtpService.send(email, otp);

    return reply.status(200).send({
      message: "OTP sent successfully",
    });
  } catch (e: any) {
    console.log("Send OTP error:", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
}

export async function resendOtp(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { email } = req.body as { email: string };

    const user = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    if (
      user.otpResendAvailableAt &&
      user.otpResendAvailableAt.getTime() > Date.now()
    ) {
      return reply.status(429).send({
        message: "Please wait before requesting another OTP",
      });
    }

    const otp = OtpService.generate();
    const otpExpiresAt = OtpService.getExpiry(5);
    const otpResendAvailableAt = OtpService.getResendWindow(60);

    await prisma.adminUser.update({
      where: { email },
      data: {
        otp,
        otpExpiresAt,
        otpVerified: false,
        otpResendAvailableAt,
      },
    });

    await OtpService.send(email, otp);

    return reply.status(200).send({
      message: "OTP resent successfully",
    });
  } catch (e: any) {
    console.log("Resend OTP error:", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
}

export async function verifyOtp(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { email, otp } = req.body as {
      email: string;
      otp: string;
    };

    const user = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    if (!user.otp || !user.otpExpiresAt) {
      return reply.status(400).send({ message: "OTP not requested" });
    }

    if (OtpService.isExpired(user.otpExpiresAt)) {
      return reply.status(400).send({ message: "OTP expired" });
    }

    if (user.otp !== otp) {
      return reply.status(400).send({ message: "Invalid OTP" });
    }

    await prisma.adminUser.update({
      where: { email },
      data: {
        otpVerified: true,
      },
    });

    return reply.status(200).send({
      message: "OTP verified successfully",
    });
  } catch (e: any) {
    console.log("Verify OTP error:", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
}

export async function setNewPassword(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    const user = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    if (!user.otpVerified) {
      return reply.status(400).send({ message: "OTP verification required" });
    }

    const hashedPassword = await hashValue(password);

    await prisma.adminUser.update({
      where: { email },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpiresAt: null,
        otpVerified: false,
        otpResendAvailableAt: null,
      },
    });

    return reply.status(200).send({
      message: "Password updated successfully",
    });
  } catch (e: any) {
    console.log("Set new password error:", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
}