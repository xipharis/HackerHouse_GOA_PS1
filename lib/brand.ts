/**
 * HH Goa 2026 brand system.
 *
 * Palette and type follow hhgoa.com — deep green, signal yellow, cream — so the
 * generated graphics read as part of the event, not as a third-party tool.
 */

export const EVENT = {
  name: "HH Goa",
  year: "2026",
  wordmark: "HH GOA",
  full: "HH GOA 2026",
  hashtag: "#FrameInGoa",
  motto: "LESS NOISE. MORE SIGNAL",
  tagline: "4 days. one rhythm. everything intentional.",
  place: "GOA, INDIA",
  window: "28 – 31 OCT 2026",
  host: "2:47 pm Studio",
  hostHandle: "@247pmstudio",
  /** Printed on the builder pass. */
  arrival: "28 OCT 2026",
  departure: "31 OCT 2026",
} as const;

export const C = {
  /** hhgoa.com primary green. */
  green: "#0B6839",
  greenDeep: "#075029",
  greenDark: "#042E19",
  ink: "#03190D",
  /** Signal yellow, the accent everything hangs off. */
  yellow: "#FEE101",
  yellowWarm: "#EDD723",
  yellowDeep: "#F9DC01",
  cream: "#FFFBE8",
  lime: "#9FD356",
} as const;

/** Yellow→lime sweep used for rings and rules. */
export const SIGNAL: readonly [number, string][] = [
  [0, C.yellow],
  [0.5, C.yellowDeep],
  [1, C.yellowWarm],
];

export const OUT = {
  /** Format A — X profile picture. */
  pfp: 1024,
  /** Format B / OG link preview — 16:9. */
  cardW: 1200,
  cardH: 675,
} as const;

export type Format = "pfp" | "card";

/**
 * Pre-filled post copy.
 *
 * The link is embedded in the body rather than passed as the intent's `url`
 * parameter, because X appends that parameter at the end and would break the
 * ordering — the hashtags have to land last. X still unfurls a URL found in the
 * body, so the link preview works either way.
 *
 * The two formats get their own opening block: the pass lists the details the
 * user typed, while the PFP collects none, so it uses standing copy rather than
 * the pass template with holes in it.
 */
export function tweetText(opts: {
  format: Format;
  name?: string;
  stack?: string;
  title?: string;
  link: string;
}) {
  const detail = (emoji: string, label: string, value?: string) => {
    const v = value?.trim();
    return v ? `${emoji} ${label} - ${v}` : null;
  };

  const opening =
    opts.format === "card"
      ? [
          "😋Embracing the vibe of Hacker House @2026 🎶",
          detail("😎", "My name", opts.name),
          detail("👤", "My Role", opts.stack),
          detail("🥷", "My alias/builder title", opts.title),
        ]
      : [
          "😋 New PFP, same Hacker House @2026 energy 🎶",
          "🌴 Framed for Goa. Locked in for the build-station.",
        ];

  return [
    ...opening,
    "",
    "😼 Embrace with me the vibe of Less noise and more signal:- ",
    "",
    opts.format === "card"
      ? "Create your own Builder Badge -> 🪪"
      : "Frame your own PFP -> 🖼️",
    opts.link,
    "",
    `${EVENT.hashtag} #HHGoa2026`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
