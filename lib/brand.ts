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
  arrival: "29 OCT 2026",
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

/** Pre-filled tweet copy. Tags the host studio and carries the hashtag. */
export function tweetText(opts: {
  format: Format;
  name?: string;
  title?: string;
}) {
  const who = opts.name?.trim();

  if (opts.format === "card") {
    return [
      `${who ? `${who} is` : "I'm"} packing for ${EVENT.full} 🌴`,
      opts.title ? `Builder pass says: ${opts.title}.` : "",
      `${EVENT.arrival} → ${EVENT.departure} · ${EVENT.place}`,
      "",
      `Less noise, more signal. See you on the sand, ${EVENT.hostHandle}`,
      EVENT.hashtag,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `New pfp, same shipping energy — ${EVENT.full} 🌴`,
    "Less noise. More signal.",
    "",
    `Framed for the build-station by ${EVENT.hostHandle}`,
    EVENT.hashtag,
  ].join("\n");
}
