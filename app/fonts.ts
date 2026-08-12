import { Archivo, JetBrains_Mono } from "next/font/google";

/**
 * Shared by the layout (for CSS) and the generator (for the canvas `font`
 * shorthand), so on-screen type and rendered type are literally the same faces.
 */
export const display = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

export const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const canvasFonts = {
  display: display.style.fontFamily,
  mono: mono.style.fontFamily,
};

/** Canvas can't wait on CSS, so force the exact weights we draw with. */
export async function ensureFontsReady() {
  if (typeof document === "undefined" || !document.fonts) return;
  const specs = [
    `900 76px ${canvasFonts.display}`,
    `800 40px ${canvasFonts.display}`,
    `700 24px ${canvasFonts.mono}`,
    `400 20px ${canvasFonts.mono}`,
  ];
  await Promise.all(
    specs.map((s) => document.fonts.load(s).catch(() => undefined)),
  );
  await document.fonts.ready;
}
