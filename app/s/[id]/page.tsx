/**
 * /s/[id] — the link a user tweets.
 *
 * Its entire job is to carry an OG image that *is* the generated graphic, so the
 * X card preview shows the artwork rather than a default thumbnail.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EVENT, OUT } from "@/lib/brand";
import { getShare } from "@/lib/server/storage";
import { siteUrl } from "@/lib/server/site";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) return { title: `${EVENT.full} — Frame Generator` };

  const who = share.name?.trim();
  const title = who
    ? `${who} · ${EVENT.full}`
    : `${EVENT.full} — ${EVENT.tagline}`;
  const description = share.title
    ? `${who ?? "A builder"} — ${share.title}. Make your own ${EVENT.hashtag} graphic.`
    : `Make your own ${EVENT.full} graphic. ${EVENT.hashtag}`;

  const url = `${siteUrl()}/s/${id}`;
  const image = {
    url: share.imageUrl,
    width: OUT.cardW,
    height: OUT.cardH,
    alt: title,
  };

  return {
    title,
    description,
    metadataBase: new URL(siteUrl()),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: `${EVENT.full}`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-6 p-6">
      <img
        src={share.imageUrl}
        alt={share.name ? `${share.name} — ${EVENT.full}` : EVENT.full}
        width={OUT.cardW}
        height={OUT.cardH}
        className="w-full rounded-2xl border border-white/10 shadow-2xl"
      />

      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-teal-300">
          {EVENT.hashtag}
        </p>
        <h1 className="mt-1 text-2xl font-black text-[#FFF4E4]">
          {share.name ? `${share.name} is going to ${EVENT.full}` : EVENT.full}
        </h1>
        {share.title && (
          <p className="mt-1 text-[#FFF4E4]/70">Certified {share.title}</p>
        )}
      </div>

      <Link
        href="/"
        className="rounded-full bg-gradient-to-r from-[#00E0C6] via-[#FF2E93] to-[#FFB347] px-6 py-3 font-bold text-[#05061A]"
      >
        Make yours →
      </Link>

      <a
        href={share.imageUrl}
        download={`hh-goa-2026-${share.id}.png`}
        className="text-sm text-[#FFF4E4]/50 underline underline-offset-4"
      >
        Download this image
      </a>
    </main>
  );
}
