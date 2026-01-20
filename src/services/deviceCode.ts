import { prisma } from "../db/client";
import crypto from "crypto";


async function generateUnique16Hex(
  field: "deviceCode" | "deviceKey",
  maxTries = 10,
): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    const value = crypto.randomBytes(8).toString("hex"); // 16 chars
    const exists = await prisma.player.findFirst({
      where: { [field]: value } as any,
      select: { id: true },
    });
    if (!exists) return value;
  }
  throw new Error(`Failed to generate unique ${field}`);
}

export  { generateUnique16Hex };