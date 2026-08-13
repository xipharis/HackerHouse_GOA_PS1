/**
 * HH Goa 2026 graphic renderers.
 *
 * Everything is drawn on a plain 2D canvas in the browser, so upload → finished
 * artwork is a single synchronous paint (a few milliseconds) with no server hop.
 *
 *   renderPfp   — Format A, 1024×1024 profile picture with a signal-yellow ring.
 *   renderPass  — Format B, the 1080×1350 builder pass (see ./pass).
 *   renderPfpShareCard — 1200×630 link-preview card wrapping a Format A pfp,
 *                        so the X card preview is never a cropped square.
 *
 * Colour discipline for Format A: deep green ground, one signal yellow, cream
 * type, with the yellow spent only on the ring. The pass runs its own, warmer
 * palette — see `PASS` in lib/brand.
 */

import { C, EVENT, OUT, SIGNAL } from "../brand";
import {
  arcText,
  bandedSun,
  coverDraw,
  Ctx,
  DEFAULT_FRAMING,
  Framing,
  grain,
  linearRamp,
  palmFrond,
  tracked,
  waveLines,
} from "./paint";

import { passPhotoWindow } from "./pass";

export { ensureCoast } from "./assets";
export {
  drawPass,
  passPhotoWindow,
  renderPass,
  /** Format B's public name in the UI, which still talks about "the card". */
  renderPass as renderCard,
  renderPassShareCard,
  type PassFields,
  type PassFields as CardFields,
  type PassFonts,
  type PassOpts,
} from "./pass";

export type Fonts = { display: string; mono: string };

export type RenderOpts = {
  photo: ImageBitmap;
  fonts: Fonts;
  framing?: Framing;
};

const disp = (f: Fonts, weight: number, size: number) =>
  `${weight} ${size}px ${f.display}`;
const mono = (f: Fonts, weight: number, size: number) =>
  `${weight} ${size}px ${f.mono}`;

/* -------------------------------------------------------------- geometry */

const RING_OUTER = OUT.pfp / 2 - 6;
const RING_W = 62;
const RING_MID = RING_OUTER - RING_W / 2;
const PHOTO_R = RING_OUTER - RING_W + 2;

/**
 * The box the photo is drawn into, in output pixels. The UI needs it to convert
 * a drag in screen pixels into a focal-point change.
 */
export function photoWindow(format: "pfp" | "card") {
  return format === "pfp" ? { w: PHOTO_R * 2, h: PHOTO_R * 2 } : passPhotoWindow();
}

/* ------------------------------------------------------------- background */

/** The shared ground: deep green, lit from one corner. */
function paintGround(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, C.green);
  g.addColorStop(0.6, C.greenDeep);
  g.addColorStop(1, C.greenDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.82, h * 0.1, 0, w * 0.82, h * 0.1, w * 0.62);
  glow.addColorStop(0, "rgba(254,225,1,0.20)");
  glow.addColorStop(0.55, "rgba(254,225,1,0.05)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const shade = ctx.createRadialGradient(w * 0.05, h, 0, w * 0.05, h, w * 0.6);
  shade.addColorStop(0, "rgba(3,25,13,0.55)");
  shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
}

/** Darkens the foot of a photo so overlaid type always has contrast. */
function scrim(ctx: Ctx, x: number, y: number, w: number, h: number, from = 0.45) {
  const g = ctx.createLinearGradient(0, y + h * from, 0, y + h);
  g.addColorStop(0, "rgba(3,25,13,0)");
  g.addColorStop(1, "rgba(3,25,13,0.86)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/* =========================================================== Format A: PFP */

export function renderPfp(canvas: HTMLCanvasElement, opts: RenderOpts) {
  const S = OUT.pfp;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const f = opts.fonts;
  const cx = S / 2;
  const cy = S / 2;

  ctx.clearRect(0, 0, S, S);

  /* Background — X crops this to a circle, so it's the downloaded square that
     benefits. Treated as a small poster in its own right. */
  paintGround(ctx, S, S);
  // Held well back: it lives outside the circular crop and must never compete
  // with the ring, which is the one thing that has to read at avatar scale.
  ctx.save();
  ctx.globalAlpha = 0.4;
  bandedSun(ctx, S * 0.95, S * 0.07, S * 0.21, C.yellow, C.green);
  ctx.restore();
  waveLines(ctx, -20, S * 0.9, S * 0.46, 4, C.yellow, 0.4);
  palmFrond(ctx, -12, S * 0.15, S * 0.3, 0.35, C.yellow, 0.22);
  palmFrond(ctx, S * 0.05, S - 6, S * 0.27, -1.15, C.lime, 0.16);

  /* The photo, front and centre. */
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, PHOTO_R, 0, Math.PI * 2);
  ctx.clip();
  coverDraw(
    ctx,
    opts.photo,
    cx - PHOTO_R,
    cy - PHOTO_R,
    PHOTO_R * 2,
    PHOTO_R * 2,
    opts.framing ?? DEFAULT_FRAMING,
  );

  // Palm silhouettes hugging the lower rim — inside the circular mask, so they
  // survive X's crop, but low and light enough not to cut across a face.
  palmFrond(ctx, cx - PHOTO_R, cy + PHOTO_R * 0.9, PHOTO_R * 0.58, -0.42, C.ink, 0.34);
  palmFrond(ctx, cx + PHOTO_R, cy + PHOTO_R * 0.95, PHOTO_R * 0.52, Math.PI + 0.42, C.ink, 0.26);
  scrim(ctx, cx - PHOTO_R, cy - PHOTO_R, PHOTO_R * 2, PHOTO_R * 2, 0.66);

  const vig = ctx.createRadialGradient(cx, cy, PHOTO_R * 0.74, cx, cy, PHOTO_R);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(3,25,13,0.5)");
  ctx.fillStyle = vig;
  ctx.fillRect(cx - PHOTO_R, cy - PHOTO_R, PHOTO_R * 2, PHOTO_R * 2);
  ctx.restore();

  /* The ring. Solid signal yellow rather than a gradient: at the 48px X renders
     an avatar at, a flat band of one loud colour is the only thing that reads. */
  ctx.save();
  ctx.lineWidth = RING_W;
  ctx.strokeStyle = linearRamp(ctx, cx - RING_OUTER, 0, cx + RING_OUTER, S, SIGNAL);
  ctx.beginPath();
  ctx.arc(cx, cy, RING_MID, 0, Math.PI * 2);
  ctx.stroke();

  // Hairlines keep the band crisp once the avatar is scaled down.
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(3,25,13,0.5)";
  ctx.beginPath();
  ctx.arc(cx, cy, RING_OUTER, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, PHOTO_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  /* Type set into the ring. Mono, not the display serif: Imbue's hairlines
     vanish at avatar scale. */
  ctx.save();
  ctx.fillStyle = C.green;
  ctx.font = mono(f, 700, 44);
  arcText(ctx, EVENT.full, cx, cy, RING_MID + 2, Math.PI / 2, 6, true);

  ctx.font = mono(f, 700, 22);
  ctx.fillStyle = "rgba(11,104,57,0.9)";
  arcText(ctx, EVENT.hashtag.toUpperCase(), cx, cy, RING_MID + 2, -Math.PI / 2, 6);

  ctx.font = mono(f, 700, 26);
  ctx.fillStyle = "rgba(11,104,57,0.75)";
  arcText(ctx, "◆", cx, cy, RING_MID + 3, 0, 0);
  arcText(ctx, "◆", cx, cy, RING_MID + 3, Math.PI, 0);
  ctx.restore();

  grain(ctx, S, S, 0.045);
  return canvas;
}

/* ============================================ Format A → link preview card */

/**
 * X renders a link card at roughly 2:1. Handing it the raw 1024² pfp would
 * centre-crop the ring off, so Format A gets its own 1200×630 composition.
 */
export function renderPfpShareCard(
  canvas: HTMLCanvasElement,
  pfp: HTMLCanvasElement,
  fonts: Fonts,
) {
  const W = OUT.ogW;
  const H = OUT.ogH;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const f = fonts;

  paintGround(ctx, W, H);
  bandedSun(ctx, W * 0.12, -14, 145, C.yellow, C.green);
  ctx.fillStyle = "rgba(7,80,41,0.62)";
  ctx.fillRect(0, 0, W, H);
  palmFrond(ctx, -30, H * 0.74, 290, -0.25, C.yellow, 0.12);
  waveLines(ctx, 44, H - 86, 340, 4, C.yellow, 0.25);

  // The avatar, masked exactly as X will mask it.
  const size = 468;
  const ax = W - size - 76;
  const ay = (H - size) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(3,25,13,0.55)";
  ctx.shadowBlur = 56;
  ctx.shadowOffsetY = 16;
  ctx.beginPath();
  ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(pfp, ax, ay, size, size);
  ctx.restore();

  const tx = 76;
  ctx.textBaseline = "alphabetic";
  ctx.font = mono(f, 700, 20);
  ctx.fillStyle = C.yellow;
  tracked(ctx, "NEW PROFILE PICTURE", tx, 210, 5);

  ctx.font = disp(f, 800, 96);
  ctx.fillStyle = C.cream;
  ctx.fillText("HH GOA", tx, 312);
  ctx.fillStyle = C.yellow;
  ctx.fillText("2026", tx, 400);

  ctx.font = mono(f, 700, 20);
  ctx.fillStyle = C.cream;
  tracked(ctx, EVENT.motto, tx, 452, 4);

  ctx.font = mono(f, 500, 17);
  ctx.fillStyle = "rgba(255,251,232,0.55)";
  tracked(ctx, `${EVENT.window} · ${EVENT.place}`, tx, 486, 3);

  ctx.font = mono(f, 700, 18);
  ctx.fillStyle = C.yellow;
  tracked(ctx, EVENT.hashtag.toUpperCase(), tx, 528, 3);

  grain(ctx, W, H, 0.04);
  return canvas;
}

/* ------------------------------------------------------------------ output */

export function toBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))),
      type,
      quality,
    );
  });
}
