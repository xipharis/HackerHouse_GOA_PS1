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
import { requestSiteUrl } from "@/lib/server/site";
import { Ambience, Footer, TopBar } from "@/app/chrome";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) return { title: `${EVENT.full} — Frame Generator` };

  const who = share.name?.trim();
  const title = who ? `${who} · ${EVENT.full}` : `${EVENT.full} — ${EVENT.motto}`;
  const description = share.title
    ? `${who ?? "A builder"} — ${share.title}. Make your own ${EVENT.hashtag} graphic.`
    : `Make your own ${EVENT.full} graphic. ${EVENT.hashtag}`;

  const origin = await requestSiteUrl();
  const url = `${origin}/s/${id}`;
  const image = {
    url: share.imageUrl,
    width: OUT.cardW,
    height: OUT.cardH,
    alt: title,
  };

  return {
    title,
    description,
    metadataBase: new URL(origin),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: EVENT.full,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: EVENT.hostHandle,
      creator: EVENT.hostHandle,
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
    <div className="grain relative min-h-dvh overflow-hidden bg-ink">
      <Ambience />
      <TopBar back />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-5 pt-4 text-center sm:px-8">
        {/* Deliberately a plain <img>: the graphic is already rendered at exactly
            the size it's displayed, so next/image would add a proxy hop for no
            gain — and the source is a Blob CDN URL that changes per share. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={share.imageUrl}
          alt={share.name ? `${share.name} — ${EVENT.full}` : EVENT.full}
          width={OUT.cardW}
          height={OUT.cardH}
          className="w-full rounded-2xl border border-cream/12 shadow-2xl"
        />

        <p className="mt-10 text-[11px] tracking-[0.24em] text-signal">
          {EVENT.hashtag.toUpperCase()}
        </p>
        <h1 className="font-display mt-3 text-4xl leading-[1.06] text-cream sm:text-6xl">
          {share.name ? `${share.name} is going to ${EVENT.full}` : EVENT.full}
        </h1>
        {share.title && (
          <p className="mt-3 text-sm text-cream/55">Certified {share.title}</p>
        )}

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/pfp"
            className="rounded-full bg-signal px-6 py-3 text-xs font-bold tracking-wide text-forest transition-opacity hover:opacity-90"
          >
            MAKE YOUR PFP →
          </Link>
          <Link
            href="/pass"
            className="rounded-full border border-cream/20 px-6 py-3 text-xs font-bold tracking-wide text-cream transition-colors hover:border-signal hover:text-signal"
          >
            MAKE A BUILDER PASS →
          </Link>
        </div>

        <a
          href={share.imageUrl}
          download={`hh-goa-2026-${share.id}.png`}
          className="mt-6 text-[11px] tracking-[0.16em] text-cream/40 underline-offset-4 hover:text-signal hover:underline"
        >
          DOWNLOAD THIS IMAGE
        </a>
      </main>

      <Footer />
    </div>
  );
}
