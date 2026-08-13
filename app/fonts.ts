import { Imbue, JetBrains_Mono, Playfair_Display, Victor_Mono } from "next/font/google";
import localFont from "next/font/local";

/**
 * The two faces hhgoa.com uses. Shared by the layout (for CSS) and the canvas
 * renderers, so on-screen type and rendered type are literally the same fonts.
 */
export const display = Imbue({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

export const mono = Victor_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

/* ---------------------------------------------------------- builder pass */

/**
 * The builder pass has its own type system — a high-contrast serif for the
 * lockup and the name, a chunky grotesk for the loud all-caps lines, and a mono
 * for the small labels. Kept separate from the site faces above: the pass is a
 * printed artefact, not a page.
 */
export const passSerif = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
});

export const passMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
});

/** Cabinet Grotesk isn't on Google Fonts, so the three used cuts ship locally. */
export const passGrotesk = localFont({
  src: [
    { path: "./_fonts/CabinetGrotesk-Medium.woff2", weight: "500", style: "normal" },
    { path: "./_fonts/CabinetGrotesk-Bold.woff2", weight: "700", style: "normal" },
    { path: "./_fonts/CabinetGrotesk-Extrabold.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
});

export const canvasFonts = {
  display: display.style.fontFamily,
  mono: mono.style.fontFamily,
};

export const passFonts = {
  serif: passSerif.style.fontFamily,
  grotesk: passGrotesk.style.fontFamily,
  mono: passMono.style.fontFamily,
};

/**
 * Canvas can't wait on CSS. Imbue is a high-contrast display serif that only
 * reads at size, so small lockups use the mono — both must be resident before
 * the first paint or the metrics come out wrong.
 */
export async function ensureFontsReady() {
  if (typeof document === "undefined" || !document.fonts) return;
  const specs = [
    `900 76px ${canvasFonts.display}`,
    `700 40px ${canvasFonts.display}`,
    `700 24px ${canvasFonts.mono}`,
    `500 20px ${canvasFonts.mono}`,
    `900 76px ${passFonts.serif}`,
    `800 30px ${passFonts.grotesk}`,
    `700 22px ${passFonts.grotesk}`,
    `700 18px ${passFonts.mono}`,
    `400 16px ${passFonts.mono}`,
  ];
  await Promise.all(
    // "Aa0" forces the subset that actually carries the glyphs we measure.
    specs.map((s) => document.fonts.load(s, "Aa0").catch(() => undefined)),
  );
  await document.fonts.ready;
}
