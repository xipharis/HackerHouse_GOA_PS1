/**
 * POST /api/share
 *
 * Takes the already-generated PNG from the browser and parks it so that
 * twitter.com can fetch it as an OG image. This is the only server round-trip
 * in the whole flow, and it happens *after* the user has seen their graphic.
 */

import { NextResponse } from "next/server";
import {
  getShare,
  newId,
  saveShare,
  type Format,
  type Upload,
} from "@/lib/server/storage";
import { requestSiteUrl } from "@/lib/server/site";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 12 * 1024 * 1024;

const clean = (v: FormDataEntryValue | null, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : undefined;

/**
 * Reads one uploaded image, trusting the bytes rather than the declared type.
 * Returns a string when the entry is present but unusable.
 */
async function readImage(
  entry: FormDataEntryValue | null,
): Promise<Upload | string> {
  if (!(entry instanceof File)) return "Missing image.";
  if (entry.size === 0 || entry.size > MAX_BYTES) {
    return "Image must be 1 byte–12 MB.";
  }
  const data = Buffer.from(await entry.arrayBuffer());
  const isPng = data
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (!isPng && !isJpeg) return "Only PNG or JPEG uploads are accepted.";
  return { data, contentType: isPng ? "image/png" : "image/jpeg" };
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const card = await readImage(form.get("image"));
  if (typeof card === "string") {
    return NextResponse.json({ error: card }, { status: card === "Missing image." ? 400 : 413 });
  }

  // The graphic at its own aspect ratio, so the share page and the download can
  // offer the real thing rather than the letterboxed link card. Optional: an
  // older client, or a failed encode, must not cost the user their link.
  const rawEntry = form.get("raw");
  const raw = rawEntry ? await readImage(rawEntry) : null;

  const format: Format = form.get("format") === "card" ? "card" : "pfp";

  try {
    const id = newId();
    const meta = await saveShare(
      id,
      card.data,
      {
        contentType: card.contentType,
        format,
        name: clean(form.get("name"), 60),
        title: clean(form.get("title"), 60),
      },
      typeof raw === "object" && raw !== null ? raw : undefined,
    );

    return NextResponse.json({
      id,
      imageUrl: meta.imageUrl,
      rawUrl: meta.rawUrl,
      shareUrl: `${await requestSiteUrl()}/s/${id}`,
    });
  } catch (err) {
    console.error("share failed", err);
    return NextResponse.json(
      { error: "Couldn't save your share link. Download still works." },
      { status: 500 },
    );
  }
}

/** Tiny helper so the client can confirm a link resolved before opening X. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const meta = await getShare(id);
  return meta
    ? NextResponse.json(meta)
    : NextResponse.json({ error: "Not found." }, { status: 404 });
}
