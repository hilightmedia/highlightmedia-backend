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

function diffSec(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.max(0, Math.floor(ms / 1000));
}

const toNullableInt = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const formatTime = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);

export { parseDateMaybe, compare, toTopLevelType, topType, diffSec, toNullableInt, formatTime };
