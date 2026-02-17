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
  playlistId: number | null;
  sessionStart: Date | null;
  sessionEnd: Date | null;
  status: "Online" | "Offline";
  lastActive: Date | null;
  sessionDurationSec: number | null;
  linked: boolean;
  location: string;
};


export type PlayerSortBy = "status" | "lastActive" | "duration" | "name";
export type PlayerStatusFilter = "Online" | "Offline";


export type BulkAddFileItem = { fileId: number; duration: number };
export type BulkAddSubPlaylistItem = { subPlaylistId: number; duration: number };

export type StartSessionParams = { deviceCode: string };
export type EndSessionParams = { deviceCode: string };

export type StartSessionBody = {
  forceNew?: boolean;
};

export type EndSessionBody = {
  endAll?: boolean;
};

export type LinkPlayerBody = {
  deviceName: string;
  deviceKey?: string;
};

export type GetPlaylistParams = {
  deviceCode: string;
  playlistId?: number;
};

export type CreatePlayLogParams = {
  deviceCode: string;
};

export type CreatePlayLogBody = {
  playlistFileId?: number | null;
  fileId: number;
  playlistId?: number | null;
  subPlaylistId?: number | null;
  isSubPlaylist?: boolean;
};


export type FileDto = {
  id: number;
  name: string;
  type: string;
  fileKey: string;
  size: number;
  duration: number | null;
  verified: boolean;
  folderId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlaylistFileDto = {
  id: number;
  playOrder: number;
  duration: number | null;
  isSubPlaylist: boolean;
  fileId: number | null;
  subPlaylistId: number | null;
  file: FileDto | null;
  subPlaylist: PlaylistDto | null;
};

export type PlaylistDto = {
  id: number;
  name: string;
  defaultDuration: number | null;
  playlistFiles: PlaylistFileDto[];
};

export type DbFile = {
  id: number;
  name: string;
  fileType: string;
  fileKey: string;
  fileSize: number;
  duration: number | null;
  verified: boolean;
  folderId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DbPlaylistFile = {
  id: number;
  playOrder: number;
  duration: number | null;
  isSubPlaylist: boolean;
  fileId: number | null;
  subPlaylistId: number | null;
  file: DbFile | null;
};

export type DbSubPlaylist = {
  id: number;
  name: string;
  defaultDuration: number | null;
  playlistFiles: DbPlaylistFile[];
};

export type ActivityItem = {
  id: string;
  type: "ONLINE" | "OFFLINE";
  playerId: number;
  playerName: string;
  at: Date;
  message: string;
};

export type ApiFile = {
  id: number;
  name: string;
  fileType: string;
  fileKey: string;
  fileSize: string;
  duration: string;
  verified: boolean;
  folderId: number | null;
  createdAt: string | Record<string, any>;
  updatedAt: string | Record<string, any>;
  signedUrl: string | null;
};


export type ApiPlaylistFile = {
  id: number;
  playOrder: number;
  duration: number | null;
  isSubPlaylist: boolean;
  fileId: number | null;
  subPlaylistId: number | null;
  file: ApiFile | null;
  subPlaylist: ApiPlaylist | null;
};

export type ApiPlaylist = {
  id: number;
  name: string;
  defaultDuration: number;
  playlistFiles: ApiPlaylistFile[];
};


export type TopClientItem = { folderId: number; folderName: string; adsPlayed: number };
export type TopPlayerItem = { playerId: number; playerName: string; adsPlayed: number };


export type FolderLogSortBy = "lastPlayed" | "totalRunTime" | "devices" | "plays" | "name";
export type FolderLogItem = {
  folderId: number;
  folderName: string;
  thumbnail: string;
  lastPlayedAt: Date | null;
  totalRunTimeSec: number;
  devices: number;
  plays: number;
};

export type FileLogSortBy = "lastPlayed" | "totalRunTime" | "devices" | "plays" | "name";

export type FileLogItem = {
  fileId: number;
  fileName: string;
  fileType: string;
  folderId: number;
  folderName: string;
  signedUrl: string;
  lastPlayedAt: Date | null;
  totalRunTimeSec: number;
  devices: number;
  plays: number;
};

export type PlaylistFileLogSortBy = "lastPlayed" | "totalRunTime" | "devices" | "plays" | "name";

export type PlaylistFileLogItem = {
  playlistFileId: number;
  playlistId: number;
  playlistName: string;
  playOrder: number;
  isSubPlaylist: boolean;
  fileId: number | null;
  fileName: string | null;
  fileType: string | null;
  signedUrl: string;
  subPlaylistId: number | null;
  subPlaylistName: string | null;
  lastPlayedAt: Date | null;
  totalRunTimeSec: number;
  devices: number;
  plays: number;
};


export type PlaylistLogSortBy = "lastPlayed" | "totalRunTime" | "devices" | "plays" | "name";

export type PlaylistLogItem = {
  playlistId: number;
  playlistName: string;
  lastPlayedAt: Date | null;
  totalRunTimeSec: number;
  devices: number;
  plays: number;
};

export type BulkAddFilesToPlaylistsBody = {
  fileIds: number[];
  playlistIds: number[];
  duration?: number;
};


