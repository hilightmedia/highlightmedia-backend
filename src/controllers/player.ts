import { FastifyReply, FastifyRequest } from "fastify";
import crypto from "crypto";
import toHttpError from "../utils/toHttpError";
import { prisma } from "../db/client";
import { PlayerRow } from "../types/types";

function diffSec(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.max(0, Math.floor(ms / 1000));
}

async function generateUnique16Hex(
  field: "deviceCode" | "deviceKey",
  maxTries = 10
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

export const getPlayers = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const players = await prisma.player.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        location: true,
        linked: true,
        deviceCode: true,
        deviceKey: true,
        updatedAt: true,
        playlist: { select: { id: true, name: true } },
        sessions: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            startedAt: true,
            endedAt: true,
            isActive: true,
            updatedAt: true,
          },
        },
      },
    });

    const now = new Date();

    const rows: PlayerRow[] = players.map((p) => {
      const s = p.sessions[0] ?? null;

      const status: "Online" | "Offline" = s?.isActive ? "Online" : "Offline";

      const sessionStart = s?.startedAt ?? null;
      const sessionEnd = s?.endedAt ?? null;

      const sessionDurationSec = s?.startedAt
        ? s.isActive
          ? diffSec(now, s.startedAt)
          : s.endedAt
            ? diffSec(s.endedAt, s.startedAt)
            : null
        : null;

      const lastActiveCandidates: Date[] = [];
      if (s?.isActive && s.startedAt) lastActiveCandidates.push(s.startedAt);
      if (s?.endedAt) lastActiveCandidates.push(s.endedAt);
      if (s?.updatedAt) lastActiveCandidates.push(s.updatedAt);
      if (p.updatedAt) lastActiveCandidates.push(p.updatedAt);

      const lastActive =
        lastActiveCandidates.length > 0
          ? new Date(Math.max(...lastActiveCandidates.map((d) => d.getTime())))
          : null;

      return {
        id: p.id,
        name: p.name,
        playlist: p.playlist?.name ?? null,
        playlistId: p.playlist?.id ?? null,
        sessionStart,
        sessionEnd,
        status,
        lastActive,
        sessionDurationSec,
        linked: p.linked,
        location: p.location,
      };
    });

    return reply.status(200).send({
      message: "Players fetched successfully",
      players: rows,
    });
  } catch (e) {
    console.log("Get players error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const createPlayer = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { name, location, playlistId } = req.body as {
      name: string;
      location: string;
      playlistId?: number | null;
    };

    if (!name?.trim())
      return reply.status(400).send({ message: "Name is required" });
    if (!location?.trim())
      return reply.status(400).send({ message: "Location is required" });

    if (playlistId !== undefined && playlistId !== null) {
      const pl = await prisma.playlist.findUnique({
        where: { id: Number(playlistId) },
        select: { id: true },
      });
      if (!pl) return reply.status(404).send({ message: "Playlist not found" });
    }

    const deviceCode = await generateUnique16Hex("deviceCode");
    const deviceKey = await generateUnique16Hex("deviceKey");

    await prisma.player.create({
      data: {
        name: name.trim(),
        location: location.trim(),
        playlistId: playlistId ?? null,
        deviceCode,
        deviceKey,
        linked: false,
      },
    });

    return reply.status(201).send({
      message: "Player created successfully",
    });
  } catch (e) {
    console.log("Create player error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const loginPlayer = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { deviceCode, deviceKey } = req.body as {
      deviceCode: string;
      deviceKey: string;
    };

    if (!deviceCode?.trim() || !deviceKey?.trim()) {
      return reply
        .status(400)
        .send({ message: "deviceCode and deviceKey are required" });
    }

    const player = await prisma.player.findFirst({
      where: {
        deviceCode: deviceCode.trim(),
        deviceKey: deviceKey.trim(),
      },
      select: {
        id: true,
        name: true,
        linked: true,
        playlistId: true,
        location: true,
      },
    });

    if (!player) {
      return reply.status(401).send({ message: "Invalid device credentials" });
    }

    const now = new Date();

    const session = await prisma.$transaction(async (tx) => {
      // End any existing active session(s) - keeps data clean
      await tx.playerSession.updateMany({
        where: { playerId: player.id, isActive: true },
        data: { isActive: false, endedAt: now },
      });

      await tx.player.update({
        where: { id: player.id },
        data: { linked: true },
      });

      return tx.playerSession.create({
        data: {
          playerId: player.id,
          startedAt: now,
          isActive: true,
        },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          isActive: true,
        },
      });
    });

    return reply.status(200).send({
      message: "Login successful",
      player: {
        id: player.id,
        name: player.name,
        playlistId: player.playlistId,
        location: player.location,
        linked: true,
      },
      session,
    });
  } catch (e) {
    console.log("Player login error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};
