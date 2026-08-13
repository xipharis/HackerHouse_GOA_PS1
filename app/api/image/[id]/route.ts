/**
 * GET /api/image/[id]
 *
 * Serves share images in the filesystem-backed (no Blob token) mode, so local
 * dev and self-hosted runs still produce a working OG image URL. With Vercel
 * Blob configured, those URLs point straight at the blob CDN and never hit this
 * route.
 */

import { readLocalImage } from "@/lib/server/storage";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // ?v=raw serves the graphic at its own aspect ratio; the default is the
  // 1200×630 link card X unfurls.
  const variant = new URL(req.url).searchParams.get("v") === "raw" ? "raw" : "card";
  const image = await readLocalImage(id.replace(/\.(png|jpe?g)$/i, ""), variant);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.body), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(image.body.byteLength),
    },
  });
}
