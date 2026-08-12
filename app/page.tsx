import Link from "next/link";
import { EVENT } from "@/lib/brand";
import { Ambience, Footer, TopBar } from "./chrome";

const STATS = [
  ["500", "elite builders"],
  ["4", "days on the sand"],
  ["0", "logins required"],
] as const;

export default function Home() {
  return (
    <div className="grain relative min-h-dvh overflow-hidden bg-ink">
      <Ambience />
      <TopBar />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* ------------------------------------------------------------ hero */}
        <section className="pt-10 sm:pt-20">
          <p className="flex items-center gap-3 text-[11px] tracking-[0.28em] text-signal">
            <span className="h-px w-8 bg-signal/60" />
            {EVENT.motto}
          </p>

          <h1 className="font-display mt-6 text-[3.2rem] leading-[1.06] text-cream sm:text-[5.5rem] lg:text-[7rem]">
            Put your face
            <br />
            <span className="text-signal">on the build-station.</span>
          </h1>

          <p className="mt-7 max-w-xl text-sm leading-relaxed text-cream/60 sm:text-base">
            Drop one photo and walk away with an {EVENT.full} profile picture or
            a builder pass — rendered instantly, in your browser. Download the
            real file, then post it with {EVENT.hashtag}.
          </p>

          {/* --------------------------------------------------------- CTAs */}
          <div className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2">
            <ActionCard
              href="/pfp"
              kicker="FORMAT A"
              title="Create the PFP"
              body="A signal-yellow frame that wraps your photo. Sized for X, and it still reads at avatar scale."
              art={<RingArt />}
            />
            <ActionCard
              href="/pass"
              kicker="FORMAT B"
              title="Generate a builder pass"
              body="Your name, your stack, a builder title you didn't pick, and the dates you land in Goa."
              art={<PassArt />}
            />
          </div>

          {/* -------------------------------------------------------- stats */}
          <dl className="mt-16 grid grid-cols-3 gap-4 border-t border-cream/10 pt-8 sm:mt-24">
            {STATS.map(([n, label]) => (
              <div key={label}>
                <dt className="font-display text-4xl text-signal sm:text-6xl">{n}</dt>
                <dd className="mt-1 text-[10px] tracking-[0.16em] text-cream/45 sm:text-[11px]">
                  {label.toUpperCase()}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 max-w-lg text-xs leading-relaxed text-cream/35">
            {EVENT.tagline} {EVENT.window} · {EVENT.place}.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

function ActionCard({
  href,
  kicker,
  title,
  body,
  art,
}: {
  href: string;
  kicker: string;
  title: string;
  body: string;
  art: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-cream/12 bg-forest/25 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-signal/60 hover:bg-forest/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal sm:p-8"
    >
      {/* The art sits behind the copy and warms up on hover. */}
      <div className="pointer-events-none absolute -bottom-6 -right-6 opacity-40 transition-all duration-500 group-hover:-translate-y-1 group-hover:opacity-70">
        {art}
      </div>

      <div className="relative">
        <span className="text-[10px] tracking-[0.24em] text-signal/80">{kicker}</span>
        <h2 className="font-display mt-3 max-w-[13ch] text-4xl leading-[1.02] text-cream sm:text-5xl">
          {title}
        </h2>
        <p className="mt-4 max-w-[30ch] text-xs leading-relaxed text-cream/55">{body}</p>
      </div>

      <span className="relative mt-10 inline-flex w-fit items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-xs font-bold tracking-wide text-forest transition-transform duration-300 group-hover:gap-3">
        Start
        <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}

/** Miniature of the Format A output. */
function RingArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-40 w-40 sm:h-48 sm:w-48" aria-hidden>
      <circle cx="60" cy="60" r="54" fill="none" stroke="#FEE101" strokeWidth="11" />
      <circle cx="60" cy="60" r="47" fill="#075029" />
      <circle cx="60" cy="49" r="15" fill="#FFFBE8" opacity="0.65" />
      <path d="M32 92 Q60 66 88 92 Z" fill="#FFFBE8" opacity="0.65" />
    </svg>
  );
}

/** Miniature of the Format B output. */
function PassArt() {
  return (
    <svg viewBox="0 0 140 120" className="h-40 w-40 sm:h-48 sm:w-48" aria-hidden>
      <rect x="12" y="18" width="116" height="84" rx="8" fill="#075029" stroke="#FEE101" strokeWidth="2.5" />
      <rect x="12" y="18" width="116" height="13" rx="8" fill="#FEE101" />
      <rect x="12" y="26" width="116" height="5" fill="#FEE101" />
      <rect x="22" y="40" width="32" height="50" rx="4" fill="#FFFBE8" opacity="0.28" />
      <rect x="63" y="42" width="52" height="7" rx="3.5" fill="#FFFBE8" opacity="0.75" />
      <rect x="63" y="55" width="34" height="5" rx="2.5" fill="#FEE101" opacity="0.85" />
      <rect x="63" y="68" width="46" height="13" rx="4" fill="#FEE101" />
      <rect x="63" y="87" width="26" height="4" rx="2" fill="#FFFBE8" opacity="0.4" />
      <rect x="95" y="87" width="20" height="4" rx="2" fill="#FFFBE8" opacity="0.4" />
    </svg>
  );
}
