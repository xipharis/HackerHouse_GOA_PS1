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
import { siteUrl } from "./site";

export type Format = "pfp" | "card";

export type ShareMeta = {
  id: string;
  imageUrl: string;
  format: Format;
  name?: string;
  title?: string;
  createdAt: string;
};

const PREFIX = "shares";
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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
  png: Buffer,
  meta: Omit<ShareMeta, "id" | "imageUrl" | "createdAt">,
): Promise<ShareMeta> {
  const createdAt = new Date().toISOString();

  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    const image = await put(`${PREFIX}/${id}/card.png`, png, {
      access: "public",
      contentType: "image/png",
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
  await fs.writeFile(path.join(localDir, `${id}.png`), png);
  const full: ShareMeta = {
    id,
    imageUrl: `${siteUrl()}/api/image/${id}`,
    createdAt,
    ...meta,
  };
  await fs.writeFile(path.join(localDir, `${id}.json`), JSON.stringify(full));
  return full;
}

/* -------------------------------------------------------------------- read */

export async function getShare(id: string): Promise<ShareMeta | null> {
  if (!/^[a-z0-9]{4,32}$/i.test(id)) return null;

  if (useBlob()) {
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

/** Local-only: raw PNG bytes, served by /api/image/[id] in dev. */
export async function readLocalImage(id: string): Promise<Buffer | null> {
  if (useBlob()) return null;
  if (!/^[a-z0-9]{4,32}$/i.test(id)) return null;
  try {
    return await fs.readFile(path.join(localDir, `${id}.png`));
  } catch {
    return null;
  }
}
