/**
 * HH Goa 2026 brand system.
 * Single source of truth for palette + copy, shared by the canvas renderers,
 * the share page and the UI.
 */

export const EVENT = {
  name: "HH Goa",
  year: "2026",
  wordmark: "HH GOA",
  full: "HH GOA 2026",
  hashtag: "#FrameInGoa",
  tagline: "BUILD BY THE SEA",
  place: "GOA, INDIA",
} as const;

/** Goa sunset over a night ocean. */
export const C = {
  night: "#080B24",
  deep: "#101641",
  indigo: "#1E2470",
  teal: "#00E0C6",
  aqua: "#38BDF8",
  coral: "#FF5E5B",
  magenta: "#FF2E93",
  amber: "#FFB347",
  gold: "#FFD166",
  sand: "#FFF4E4",
  ink: "#05061A",
} as const;

/** Sunset ramp used for rings, bars and highlights. */
export const SUNSET: readonly [number, string][] = [
  [0.0, C.teal],
  [0.32, C.aqua],
  [0.58, C.magenta],
  [0.8, C.coral],
  [1.0, C.amber],
];

export const OUT = {
  /** Format A — X profile picture. */
  pfp: 1024,
  /** Format B / OG link preview — 16:9. */
  cardW: 1200,
  cardH: 675,
} as const;

export type Format = "pfp" | "card";

export function tweetText(opts: {
  format: Format;
  name?: string;
  title?: string;
}) {
  const who = opts.name?.trim();
  if (opts.format === "card") {
    const t = opts.title ? ` — certified ${opts.title}.` : ".";
    return `${who ? `${who} is` : "I'm"} heading to ${EVENT.full}${t}\nBuilding by the sea 🌴🌊\n\n${EVENT.hashtag}`;
  }
  return `Locked in for ${EVENT.full} 🌴\nNew pfp, same shipping energy.\n\n${EVENT.hashtag}`;
}
