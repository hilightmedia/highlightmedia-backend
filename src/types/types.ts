import { FastifyRequest } from 'fastify'

export type Request = FastifyRequest

export type MulterFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

export type SignedUrlResult = {
  key: string;
  url: string;
};

export type SortBy = "name" | "folderSize" | "lastModified" | "validityPeriod" | "validityDate";
export type SortOrder = "asc" | "desc";
export type SizeBucket = "0-10" | "10-100" | "100+";
export type StatusFilter = "running" | "completed" | "expiring";
export type MediaStatus = "active" | "inactive";

export type SortByFile = "name" | "size" | "createdAt" | "fileType";
export type SortByPlaylist = "name" | "items" | "lastModified" | "duration";

export type SortByPlaylistFile = "name" | "type" | "updatedAt" | "size" | "duration";
export type DurationBucket = "0-3" | "5-10" | "10+";

export type PlayerRow = {
  id: number;
  name: string;
  playlist: string | null;
  sessionStart: Date | null;
  sessionEnd: Date | null;
  status: "Online" | "Offline";
  lastActive: Date | null;
  sessionDurationSec: number | null;
  linked: boolean;
  location: string;
};


export type BulkAddFileItem = { fileId: number; duration: number };
export type BulkAddSubPlaylistItem = { subPlaylistId: number; duration: number };