import Link from "next/link";
import { EVENT } from "@/lib/brand";

/** Thin fixed-width bar used at the top of every page. */
export function TopBar({ back = false }: { back?: boolean }) {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link href="/" className="group flex items-baseline gap-2">
        <span className="font-display text-2xl text-cream transition-colors group-hover:text-signal">
          HH GOA
        </span>
        <span className="rounded bg-signal px-1.5 py-0.5 text-[11px] font-bold text-forest">
          ’26
        </span>
      </Link>

      {back ? (
        <Link
          href="/"
          className="text-[11px] tracking-[0.18em] text-cream/50 transition-colors hover:text-signal"
        >
          ← BACK
        </Link>
      ) : (
        <span className="hidden text-[11px] tracking-[0.18em] text-cream/50 sm:block">
          {EVENT.window} · {EVENT.place}
        </span>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-10 pt-16 sm:px-8">
      <div className="flex flex-col gap-3 border-t border-cream/10 pt-6 text-[11px] tracking-[0.16em] text-cream/40 sm:flex-row sm:items-center sm:justify-between">
        <span>{EVENT.motto}</span>
        <span>
          A fan-made frame tool for{" "}
          <a
            href="https://x.com/247pmstudio"
            target="_blank"
            rel="noreferrer"
            className="text-signal/70 underline-offset-4 hover:underline"
          >
            {EVENT.hostHandle}
          </a>
        </span>
      </div>
    </footer>
  );
}

/** Big soft glow + palm silhouettes behind the content. */
export function Ambience() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-40 -top-56 h-[34rem] w-[34rem] rounded-full bg-signal/15 blur-[120px]" />
      <div className="absolute -bottom-72 -left-40 h-[32rem] w-[32rem] rounded-full bg-moss/10 blur-[130px]" />
      <Frond className="absolute -left-16 top-24 h-72 w-72 rotate-[18deg] text-signal/[0.07]" />
      <Frond className="absolute -right-20 bottom-10 h-80 w-80 -rotate-[150deg] text-moss/[0.07]" />
    </div>
  );
}

/** One arching palm frond, drawn as an SVG so it scales with the layout. */
export function Frond({ className }: { className?: string }) {
  const leaflets = Array.from({ length: 13 }, (_, i) => {
    const t = (i + 1) / 14;
    const x = 8 + t * 84;
    const y = 52 - Math.sin(t * Math.PI * 0.62) * 30;
    const len = 26 * Math.sin(t * Math.PI) ** 0.7;
    return { x, y, len };
  });

  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <path
        d="M8 52 Q 40 20 92 22"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {leaflets.map((l, i) => (
        <g key={i}>
          <path
            d={`M${l.x} ${l.y} q ${l.len * 0.3} ${-l.len * 0.75} ${l.len * 0.72} ${-l.len}`}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d={`M${l.x} ${l.y} q ${l.len * 0.3} ${l.len * 0.75} ${l.len * 0.72} ${l.len}`}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}
