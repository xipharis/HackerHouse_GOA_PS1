/**
 * HH Goa 2026 brand system.
 *
 * Palette and type follow hhgoa.com — deep green, signal yellow, cream — so the
 * generated graphics read as part of the event, not as a third-party tool.
 */

import { clampWeighted, TWEET_LIMIT, URL_COST, weightedLength } from "./tweet";

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
 * Must fit 280 characters: X Premium is not a fair assumption, and an over-long
 * pre-fill lands in the composer with Post already greyed out. The copy is kept
 * lean enough that even three maxed-out fields fit, and the user's own text is
 * trimmed as a last resort rather than the post silently breaking.
 *
 * The link is embedded in the body rather than passed as the intent's `url`
 * parameter, because X appends that parameter at the end and would break the
 * ordering — the hashtags have to land last. X still unfurls a URL found in the
 * body, so the link preview works either way.
 */

const SIGNAL_LINE = "😼 Less noise. More signal.";
const TAGS = `${EVENT.hashtag} #HHGoa2026`;

type TweetOpts = {
  format: Format;
  name?: string;
  stack?: string;
  title?: string;
  link: string;
};

function compose(
  format: Format,
  link: string,
  name: string,
  stack: string,
  title: string,
): string {
  const line = (emoji: string, label: string, value: string) =>
    value ? `${emoji} ${label} - ${value}` : null;

  const body =
    format === "card"
      ? [
          "😋 Hacker House Goa 2026 🎶",
          line("😎", "My name", name),
          line("👤", "My Role", stack),
          line("🥷", "My alias/builder title", title),
          "",
          SIGNAL_LINE,
          "",
          "Make your own 🪪",
        ]
      : [
          "😋 New PFP, Hacker House Goa 2026 energy 🎶",
          "🌴 Framed for the build-station.",
          "",
          SIGNAL_LINE,
          "",
          "Frame your own 🖼",
        ];

  return [...body, link, "", TAGS].filter((l) => l !== null).join("\n");
}

export function tweetText(opts: TweetOpts): string {
  const tidy = (v?: string) => v?.replace(/\s+/g, " ").trim() ?? "";
  let name = tidy(opts.name);
  let stack = tidy(opts.stack);
  let title = tidy(opts.title);

  let out = compose(opts.format, opts.link, name, stack, title);
  if (weightedLength(out) <= TWEET_LIMIT) return out;

  // Over budget: shave the longest field one character at a time so the loss is
  // spread across whichever entries are actually long, rather than always
  // gutting the last one.
  for (let guard = 0; guard < 400; guard++) {
    const fields = [
      [name, (v: string) => (name = v)] as const,
      [stack, (v: string) => (stack = v)] as const,
      [title, (v: string) => (title = v)] as const,
    ];
    const longest = fields.reduce((a, b) => (b[0].length > a[0].length ? b : a));
    if (longest[0].length <= 4) break; // nothing meaningful left to give
    longest[1](clampWeighted(longest[0], weightedLength(longest[0]) - 2));

    out = compose(opts.format, opts.link, name, stack, title);
    if (weightedLength(out) <= TWEET_LIMIT) return out;
  }
  return out;
}

/**
 * Weighted length of the post this input would produce, for the live counter.
 * The real permalink isn't known until upload, but every URL costs the same.
 */
export function tweetLength(opts: Omit<TweetOpts, "link">): number {
  return weightedLength(tweetText({ ...opts, link: "x".repeat(URL_COST) }));
}
