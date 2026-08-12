/**
 * GET /api/image/[id]
 *
 * Serves share PNGs in the filesystem-backed (no Blob token) mode, so local dev
 * and self-hosted runs still produce a working OG image URL. With Vercel Blob
 * configured, OG images point straight at the blob CDN and never hit this route.
 */

import { readLocalImage } from "@/lib/server/storage";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const png = await readLocalImage(id.replace(/\.png$/i, ""));
  if (!png) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(png.byteLength),
    },
  });
}
