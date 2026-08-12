/**
 * POST /api/share
 *
 * Takes the already-generated PNG from the browser and parks it so that
 * twitter.com can fetch it as an OG image. This is the only server round-trip
 * in the whole flow, and it happens *after* the user has seen their graphic.
 */

import { NextResponse } from "next/server";
import { getShare, newId, saveShare, type Format } from "@/lib/server/storage";
import { siteUrl } from "@/lib/server/site";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 12 * 1024 * 1024;

const clean = (v: FormDataEntryValue | null, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : undefined;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing image." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 1 byte–12 MB." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Trust the bytes, not the declared type: verify the PNG magic number.
  const isPng = bytes.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  if (!isPng) {
    return NextResponse.json({ error: "Only PNG uploads are accepted." }, { status: 415 });
  }

  const format: Format = form.get("format") === "card" ? "card" : "pfp";

  try {
    const id = newId();
    const meta = await saveShare(id, bytes, {
      format,
      name: clean(form.get("name"), 60),
      title: clean(form.get("title"), 60),
    });

    return NextResponse.json({
      id,
      imageUrl: meta.imageUrl,
      shareUrl: `${siteUrl()}/s/${id}`,
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
