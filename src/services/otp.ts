import type { PrismaClient } from "@prisma/client";
import { env } from "../config/env";
import { errorCodes } from "../utils/errors";
import HttpError from "../utils/httpError";

const OTP_TTL_SECONDS = Number(env.OTP_TTL_SECONDS ?? 300); // 5m
const OTP_MAX_VERIFY_ATTEMPTS = Number(env.OTP_MAX_VERIFY_ATTEMPTS ?? 5);
const OTP_MAX_PER_HOUR = Number(env.OTP_MAX_PER_HOUR ?? 5);

function genOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}



export async function verifyOtp(
  prisma: PrismaClient,
  mobile: string,
  otp: string,
) {
  const rec = await prisma.otp_verification.findFirst({
    where: { mobile, is_active: true },
    orderBy: { created_at: "desc" },
  });

  if (!rec) throw new HttpError(errorCodes.UNAUTHORIZED, 401);

  if (rec.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    await prisma.otp_verification.update({
      where: { id: rec.id },
      data: { is_active: false },
    });
    throw new HttpError(errorCodes.OTP_ATTEMPTS_EXCEEDED, 429);
  }

  if (new Date() > new Date(rec.expires_at)) {
    await prisma.otp_verification.update({
      where: { id: rec.id },
      data: { is_active: false },
    });
    throw new HttpError(errorCodes.OTP_EXPIRED, 400);
  }

  if (rec.otp !== otp) {
    await prisma.otp_verification.update({
      where: { id: rec.id },
      data: { attempts: { increment: 1 } },
    });
    throw new HttpError(errorCodes.INVALID_OTP, 400);
  }

  return prisma.otp_verification.update({
    where: { id: rec.id },
    data: { verified: true },
  });
}

export async function assertLoginWindow(
  prisma: PrismaClient,
  verificationId: string,
  mobile: string,
) {
  const rec = await prisma.otp_verification.findUnique({
    where: { id: verificationId, mobile },
  });
  if (!rec || rec.mobile !== mobile || !rec.verified)
    throw new HttpError(errorCodes.UNAUTHORIZED, 401);

  const secondsSinceVerify =
    (Date.now() - new Date(rec.updated_at).getTime()) / 1000;
  if (secondsSinceVerify > 30)
    throw new HttpError(errorCodes.OTP_WINDOW_EXPIRED, 400);
  return rec;
}

export async function assertSignupWindow(
  prisma: PrismaClient,
  verificationId: string,
  mobile: string,
) {
  const rec = await prisma.otp_verification.findUnique({
    where: { id: verificationId, mobile },
  });
  if (!rec || !rec.verified) throw new HttpError(errorCodes.UNAUTHORIZED, 401);

  // const secondsSinceVerify = (Date.now() - new Date(rec.updated_at).getTime()) / 10000;
  // if (secondsSinceVerify > 8 * 60) throw new HttpError(errorCodes.OTP_WINDOW_EXPIRED, 400);
  return rec;
}
