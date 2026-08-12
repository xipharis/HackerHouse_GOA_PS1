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
  const image = await readLocalImage(id.replace(/\.(png|jpe?g)$/i, ""));
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.body), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(image.body.byteLength),
    },
  });
}
