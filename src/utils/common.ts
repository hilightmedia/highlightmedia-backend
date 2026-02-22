import { ONLINE_THRESHOLD_MS } from "../config/constants";
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

const parseDateRange = (raw?: unknown) => {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const start = new Date(`${s}T00:00:00.000Z`);
  const end = new Date(`${s}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
};

const isOnline = (lastActiveAt?: Date | null, isActive?: boolean | null) => {
  if (!isActive) return false;
  if (!lastActiveAt) return false;
  return Date.now() - lastActiveAt.getTime() <= ONLINE_THRESHOLD_MS;
};

const parseRange = (startDate?: string, endDate?: string) => {
  const isValid = (v?: string) => v && /^\d{4}-\d{2}-\d{2}$/.test(v);

  let start: Date;
  let end: Date;

  if (isValid(startDate) && isValid(endDate)) {
    const [sy, sm, sd] = startDate!.split("-").map(Number);
    const [ey, em, ed] = endDate!.split("-").map(Number);

    start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);

    end = new Date(ey, em - 1, ed + 1, 0, 0, 0, 0); // exclusive
  } else {
    const now = new Date();

    start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );

    end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0,
    );
  }

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return null;

  return { start, end };
};
    const parseLocalRange = (startDate?: string, endDate?: string) => {
      const isValid = (v?: string) => v && /^\d{4}-\d{2}-\d{2}$/.test(v);

      let start: Date;
      let endExclusive: Date;

      if (isValid(startDate) && isValid(endDate)) {
        const [sy, sm, sd] = startDate!.split("-").map(Number);
        const [ey, em, ed] = endDate!.split("-").map(Number);

        start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);

        const end = new Date(ey, em - 1, ed, 0, 0, 0, 0);
        endExclusive = new Date(end);
        endExclusive.setDate(endExclusive.getDate() + 1);
      } else {
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }

      return { start, end:endExclusive };
    };


export {
  parseDateMaybe,
  compare,
  toTopLevelType,
  topType,
  diffSec,
  toNullableInt,
  formatTime,
  isOnline,
  parseDateRange,
  parseRange,
  parseLocalRange
};
