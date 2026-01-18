import { SortOrder } from "../types/types";

function parseDateMaybe(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function compare(a: any, b: any, order: SortOrder) {
  if (a === b) return 0;
  const res = a < b ? -1 : 1;
  return order === "asc" ? res : -res;
}

function toTopLevelType(mime?: string | null) {
  if (!mime) return null;
  return mime.split("/")[0];
}

function topType(mimeOrType: string) {
  return mimeOrType.includes("/") ? mimeOrType.split("/")[0] : mimeOrType;
}


export { parseDateMaybe, compare, toTopLevelType, topType };