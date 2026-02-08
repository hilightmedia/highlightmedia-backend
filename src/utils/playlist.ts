import { DbFile, ApiFile, DbPlaylistFile, ApiPlaylistFile } from "../types/types";


export const toApiFileBase = (f: DbFile | null): Omit<ApiFile, "signedUrl"> | null => {
  if (!f) return null;
  return {
    id: f.id,
    name: f.name,
    fileType: f.fileType,
    fileKey: f.fileKey,
    fileSize: String(f.fileSize ?? ""),
    duration: String(f.duration ?? ""),
    verified: f.verified,
    folderId: f.folderId ?? null,
    createdAt: typeof f.createdAt === "string" ? f.createdAt : f.createdAt,
    updatedAt: typeof f.updatedAt === "string" ? f.updatedAt : f.updatedAt,
  };
};

export const toApiPlaylistFileBase = (pf: DbPlaylistFile) => {
  return {
    id: pf.id,
    playOrder: pf.playOrder,
    duration: pf.duration ?? null,
    isSubPlaylist: !!pf.isSubPlaylist,
    fileId: pf.fileId ?? null,
    subPlaylistId: pf.subPlaylistId ?? null,
    file: null as ApiFile | null,
  };
};