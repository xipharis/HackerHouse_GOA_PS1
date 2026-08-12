/**
 * Share storage.
 *
 * Shares exist only so the X link preview can show the real generated graphic.
 * Vercel Blob is used when a token is configured; otherwise we fall back to the
 * local filesystem so `npm run dev` works with zero setup.
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { requestSiteUrl } from "./site";

export type Format = "pfp" | "card";

export type ShareMeta = {
  id: string;
  imageUrl: string;
  contentType: string;
  format: Format;
  name?: string;
  title?: string;
  createdAt: string;
};

const PREFIX = "shares";
/** Named to avoid the `use*` prefix, which reads as a React hook to linters. */
const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const localDir = path.join(process.cwd(), ".data", PREFIX);

export function newId(): string {
  // 10 chars of base36 — short enough for a tidy URL, ~52 bits of entropy.
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 10);
}

/* ------------------------------------------------------------------- write */

export async function saveShare(
  id: string,
  data: Buffer,
  meta: Omit<ShareMeta, "id" | "imageUrl" | "createdAt">,
): Promise<ShareMeta> {
  const createdAt = new Date().toISOString();
  const ext = meta.contentType === "image/png" ? "png" : "jpg";

  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    const image = await put(`${PREFIX}/${id}/card.${ext}`, data, {
      access: "public",
      contentType: meta.contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    const full: ShareMeta = { id, imageUrl: image.url, createdAt, ...meta };
    await put(`${PREFIX}/${id}/meta.json`, JSON.stringify(full), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return full;
  }

  await fs.mkdir(localDir, { recursive: true });
  await fs.writeFile(path.join(localDir, `${id}.${ext}`), data);
  const full: ShareMeta = {
    id,
    imageUrl: `${await requestSiteUrl()}/api/image/${id}`,
    createdAt,
    ...meta,
  };
  await fs.writeFile(path.join(localDir, `${id}.json`), JSON.stringify(full));
  return full;
}

/* -------------------------------------------------------------------- read */

export async function getShare(id: string): Promise<ShareMeta | null> {
  if (!/^[a-z0-9]{4,32}$/i.test(id)) return null;

  if (blobEnabled()) {
    try {
      const { list } = await import("@vercel/blob");
      // addRandomSuffix is off, but the store host isn't known until we look it
      // up, so we list the share's folder and read the meta object it returns.
      const { blobs } = await list({ prefix: `${PREFIX}/${id}/`, limit: 10 });
      const metaBlob = blobs.find((b) => b.pathname.endsWith("meta.json"));
      if (!metaBlob) return null;
      const res = await fetch(metaBlob.url, {
        next: { revalidate: 60 * 60 * 24 },
      });
      if (!res.ok) return null;
      return (await res.json()) as ShareMeta;
    } catch {
      return null;
    }
  }

  try {
    const raw = await fs.readFile(path.join(localDir, `${id}.json`), "utf8");
    return JSON.parse(raw) as ShareMeta;
  } catch {
    return null;
  }
}

/** Local-only: raw image bytes, served by /api/image/[id] in dev. */
export async function readLocalImage(
  id: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  if (blobEnabled()) return null;
  if (!/^[a-z0-9]{4,32}$/i.test(id)) return null;
  for (const [ext, contentType] of [
    ["png", "image/png"],
    ["jpg", "image/jpeg"],
  ] as const) {
    try {
      return { body: await fs.readFile(path.join(localDir, `${id}.${ext}`)), contentType };
    } catch {
      /* try the next extension */
    }
  }
  return null;
}
