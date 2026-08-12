import { Imbue, Victor_Mono } from "next/font/google";

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

export const canvasFonts = {
  display: display.style.fontFamily,
  mono: mono.style.fontFamily,
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
  ];
  await Promise.all(
    specs.map((s) => document.fonts.load(s).catch(() => undefined)),
  );
  await document.fonts.ready;
}
