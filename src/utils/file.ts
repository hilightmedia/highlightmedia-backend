export const sanitizeSegment = (str = "") => {
  return String(str)
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")   // drop non filename-safe
    .trim()
    .replace(/\s+/g, "-")        // spaces -> dashes
    .toLowerCase();
}

export const ts = () => {
  return Date.now();
}

export const ALLOWED_MIME = new Set([
  // images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  // videos
  "video/mp4",
  "video/webm",
  "video/quicktime",

  // pdf
  "application/pdf",
]);