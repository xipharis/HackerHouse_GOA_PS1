/**
 * HH Goa 2026 graphic renderers.
 *
 * Everything is drawn on a plain 2D canvas in the browser, so upload → finished
 * artwork is a single synchronous paint (a few milliseconds) with no server hop.
 *
 *   renderPfp   — Format A, 1024×1024 profile picture with a branded ring.
 *   renderCard  — Format B, 1200×675 builder ID badge.
 *   renderPfpShareCard — 1200×675 link-preview card wrapping a Format A pfp,
 *                        so the X card preview is never a cropped square.
 */

import { C, EVENT, OUT, SUNSET } from "../brand";
import { badgeId } from "../titles";
import {
  arcText,
  bandedSun,
  conicRamp,
  coverDraw,
  Ctx,
  DEFAULT_FRAMING,
  ellipsize,
  fitFontSize,
  Framing,
  grain,
  linearRamp,
  palmFrond,
  roundRect,
  tracked,
  trackedWidth,
  waveLines,
} from "./paint";

export type Fonts = { display: string; mono: string };

export type CardFields = {
  name: string;
  stack: string;
  title: string;
  seed?: number;
};

export type RenderOpts = {
  photo: ImageBitmap;
  fonts: Fonts;
  framing?: Framing;
};

const disp = (f: Fonts, weight: number, size: number) =>
  `${weight} ${size}px ${f.display}`;
const mono = (f: Fonts, weight: number, size: number) =>
  `${weight} ${size}px ${f.mono}`;

/* ------------------------------------------------------------- background */

/** The shared night-ocean ground: deep vertical gradient + a warm horizon glow. */
function paintNight(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, C.deep);
  g.addColorStop(0.55, C.night);
  g.addColorStop(1, C.ink);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.78, h * 0.12, 0, w * 0.78, h * 0.12, w * 0.6);
  glow.addColorStop(0, "rgba(255,46,147,0.30)");
  glow.addColorStop(0.5, "rgba(255,94,91,0.10)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const cool = ctx.createRadialGradient(w * 0.1, h, 0, w * 0.1, h, w * 0.55);
  cool.addColorStop(0, "rgba(0,224,198,0.16)");
  cool.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, w, h);
}

/** Darkens the bottom of a photo so overlaid type always has contrast. */
function scrim(ctx: Ctx, x: number, y: number, w: number, h: number, from = 0.45) {
  const g = ctx.createLinearGradient(0, y + h * from, 0, y + h);
  g.addColorStop(0, "rgba(5,6,26,0)");
  g.addColorStop(1, "rgba(5,6,26,0.82)");
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

  const RING_OUTER = S / 2 - 6; // 506
  const RING_W = 60;
  const RING_MID = RING_OUTER - RING_W / 2;
  const PHOTO_R = RING_OUTER - RING_W + 2;

  ctx.clearRect(0, 0, S, S);

  /* --- background: only visible in the square download, X crops it to a circle,
         so this is where the "poster" branding lives. --- */
  paintNight(ctx, S, S);
  bandedSun(
    ctx,
    S * 0.94,
    S * 0.08,
    S * 0.2,
    linearRamp(ctx, 0, S * -0.1, 0, S * 0.3, [
      [0, C.gold],
      [0.55, C.coral],
      [1, C.magenta],
    ]),
    C.night,
  );
  waveLines(ctx, -20, S * 0.9, S * 0.45, 4, C.teal, 0.5);
  palmFrond(ctx, -10, S * 0.14, S * 0.3, 0.35, C.teal, 0.32);
  palmFrond(ctx, S * 0.06, S - 8, S * 0.28, -1.15, C.aqua, 0.22);

  /* --- the photo, front and centre --- */
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

  // Palm silhouettes arching in from the lower corners of the circle. These sit
  // inside the crop, so they survive X's circular mask — the Goa tell at 48px.
  palmFrond(ctx, cx - PHOTO_R * 0.98, cy + PHOTO_R * 0.72, PHOTO_R * 0.85, -0.62, C.ink, 0.5);
  palmFrond(ctx, cx + PHOTO_R * 0.98, cy + PHOTO_R * 0.78, PHOTO_R * 0.8, Math.PI + 0.62, C.ink, 0.42);
  scrim(ctx, cx - PHOTO_R, cy - PHOTO_R, PHOTO_R * 2, PHOTO_R * 2, 0.62);

  // Inner shading so the photo sits *under* the ring rather than beside it.
  const vig = ctx.createRadialGradient(cx, cy, PHOTO_R * 0.72, cx, cy, PHOTO_R);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(5,6,26,0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(cx - PHOTO_R, cy - PHOTO_R, PHOTO_R * 2, PHOTO_R * 2);
  ctx.restore();

  /* --- the ring --- */
  ctx.save();
  ctx.lineWidth = RING_W;
  ctx.strokeStyle = conicRamp(ctx, cx, cy, Math.PI * 0.75);
  ctx.beginPath();
  ctx.arc(cx, cy, RING_MID, 0, Math.PI * 2);
  ctx.stroke();

  // Hairlines top and bottom of the band keep the edge crisp after downscaling.
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(5,6,26,0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, RING_OUTER, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, PHOTO_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  /* --- type set into the ring --- */
  ctx.save();
  ctx.fillStyle = C.ink;
  ctx.font = disp(f, 900, 46);
  arcText(ctx, EVENT.full, cx, cy, RING_MID + 1, Math.PI / 2, 7, true);

  ctx.font = mono(f, 700, 23);
  ctx.fillStyle = "rgba(5,6,26,0.82)";
  arcText(ctx, `${EVENT.hashtag.toUpperCase()}`, cx, cy, RING_MID + 1, -Math.PI / 2, 6);

  // Star separators where the two runs of text meet.
  ctx.font = disp(f, 900, 30);
  ctx.fillStyle = "rgba(5,6,26,0.7)";
  arcText(ctx, "✦", cx, cy, RING_MID + 2, 0, 0);
  arcText(ctx, "✦", cx, cy, RING_MID + 2, Math.PI, 0);
  ctx.restore();

  grain(ctx, S, S, 0.05);
  return canvas;
}

/* ====================================================== Format B: ID card */

export function renderCard(
  canvas: HTMLCanvasElement,
  opts: RenderOpts & { fields: CardFields },
) {
  const W = OUT.cardW;
  const H = OUT.cardH;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const f = opts.fonts;
  const { name, stack, title, seed = 0 } = opts.fields;

  const HEADER_H = 62;
  const PAD = 44;

  ctx.clearRect(0, 0, W, H);
  paintNight(ctx, W, H);

  /* --- ambience --- */
  bandedSun(
    ctx,
    W * 0.72,
    HEADER_H + 40,
    200,
    linearRamp(ctx, 0, HEADER_H - 120, 0, HEADER_H + 240, [
      [0, C.gold],
      [0.5, C.coral],
      [1, C.magenta],
    ]),
    C.night,
  );
  // Knock the sun back so it reads as atmosphere, not a shape competing with type.
  ctx.fillStyle = "rgba(8,11,36,0.72)";
  ctx.fillRect(0, HEADER_H, W, H - HEADER_H);

  palmFrond(ctx, W + 30, H * 0.2, 300, Math.PI - 0.5, C.teal, 0.18);
  palmFrond(ctx, W * 0.99, H + 20, 260, -Math.PI / 2 - 0.5, C.aqua, 0.14);
  waveLines(ctx, W * 0.52, H - 82, W * 0.44, 4, C.teal, 0.35);

  /* --- header strip: a badge's lanyard band --- */
  ctx.save();
  ctx.fillStyle = linearRamp(ctx, 0, 0, W, 0);
  ctx.fillRect(0, 0, W, HEADER_H);
  ctx.beginPath();
  ctx.rect(0, 0, W, HEADER_H);
  ctx.clip();
  ctx.fillStyle = "rgba(5,6,26,0.86)";
  ctx.font = mono(f, 700, 22);
  ctx.textBaseline = "middle";
  const marquee = `${EVENT.full}  ✦  ${EVENT.tagline}  ✦  ${EVENT.hashtag.toUpperCase()}  ✦  ${EVENT.place}  ✦  `;
  const unit = trackedWidth(ctx, marquee, 3);
  for (let x = -20; x < W; x += unit) tracked(ctx, marquee, x, HEADER_H / 2 + 1, 3);
  ctx.restore();

  /* --- photo panel --- */
  const pw = 388;
  const px = PAD;
  const py = HEADER_H + PAD;
  const ph = H - py - PAD;
  const pr = 26;

  ctx.save();
  roundRect(ctx, px, py, pw, ph, pr);
  ctx.save();
  ctx.clip();
  coverDraw(ctx, opts.photo, px, py, pw, ph, opts.framing ?? DEFAULT_FRAMING);
  scrim(ctx, px, py, pw, ph, 0.68);
  ctx.restore();

  // Gradient edge — the same ramp as the ring, so both formats read as one kit.
  ctx.lineWidth = 6;
  ctx.strokeStyle = linearRamp(ctx, px, py, px + pw, py + ph);
  ctx.stroke();
  ctx.restore();

  // Badge number sitting on the photo's dark foot.
  ctx.save();
  ctx.font = mono(f, 700, 21);
  ctx.fillStyle = C.teal;
  ctx.textBaseline = "alphabetic";
  tracked(ctx, badgeId(name, stack, seed), px + 26, py + ph - 28, 3);
  ctx.restore();

  /* --- right column --- */
  const cxLeft = px + pw + 40;
  const colW = W - cxLeft - PAD;
  let y = py + 6;

  ctx.textBaseline = "alphabetic";

  // Eyebrow
  ctx.font = mono(f, 700, 20);
  ctx.fillStyle = C.teal;
  tracked(ctx, "BUILDER ID", cxLeft, y + 16, 6);

  // Wordmark, right-aligned against the eyebrow
  ctx.font = disp(f, 900, 40);
  const wmW = trackedWidth(ctx, EVENT.wordmark, 2);
  ctx.fillStyle = C.sand;
  tracked(ctx, EVENT.wordmark, cxLeft + colW - wmW - 74, y + 20, 2);

  // '26 chip
  ctx.save();
  roundRect(ctx, cxLeft + colW - 66, y - 8, 66, 38, 10);
  ctx.fillStyle = linearRamp(ctx, cxLeft + colW - 66, y - 8, cxLeft + colW, y + 30, [
    [0, C.amber],
    [1, C.coral],
  ]);
  ctx.fill();
  ctx.font = disp(f, 900, 24);
  ctx.fillStyle = C.ink;
  ctx.textAlign = "center";
  ctx.fillText("’26", cxLeft + colW - 33, y + 20);
  ctx.textAlign = "left";
  ctx.restore();

  y += 46;
  ctx.fillStyle = "rgba(255,244,228,0.18)";
  ctx.fillRect(cxLeft, y, colW, 2);

  /* Name — shrinks to fit, then truncates as a last resort. */
  y += 92;
  const nameSize = fitFontSize(
    ctx,
    name || "Your Name",
    colW,
    (s) => disp(f, 900, s),
    76,
    36,
    0,
  );
  ctx.fillStyle = C.sand;
  ctx.fillText(ellipsize(ctx, name || "Your Name", colW), cxLeft, y);

  /* Stack / role */
  y += 46;
  ctx.font = mono(f, 700, 25);
  ctx.fillStyle = C.aqua;
  const stackLine = (stack || "builder").toUpperCase();
  ctx.font = mono(f, 700, stackLine.length > 34 ? 19 : 25);
  tracked(ctx, ellipsize(ctx, stackLine, colW, 4), cxLeft, y, 4);

  /* Builder title — the payoff, so it gets the loudest treatment. */
  y += 54;
  ctx.font = mono(f, 700, 18);
  ctx.fillStyle = "rgba(255,244,228,0.55)";
  tracked(ctx, "BUILDER TITLE", cxLeft, y, 5);

  y += 20;
  const chipH = 74;
  const titleText = title || "Sunset Shipper";
  const titleSize = fitFontSize(
    ctx,
    titleText,
    colW - 56,
    (s) => disp(f, 900, s),
    38,
    20,
    0,
  );
  const chipW = Math.min(colW, trackedWidth(ctx, titleText, 0) + 56);

  ctx.save();
  roundRect(ctx, cxLeft, y, chipW, chipH, 16);
  ctx.fillStyle = linearRamp(ctx, cxLeft, y, cxLeft + chipW, y + chipH, SUNSET);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.font = disp(f, 900, titleSize);
  ctx.textBaseline = "middle";
  ctx.fillText(ellipsize(ctx, titleText, chipW - 40), cxLeft + 28, y + chipH / 2 + 1);
  ctx.restore();

  /* Foot */
  ctx.textBaseline = "alphabetic";
  ctx.font = mono(f, 700, 20);
  ctx.fillStyle = C.gold;
  tracked(ctx, EVENT.hashtag.toUpperCase(), cxLeft, H - PAD - 8, 4);

  ctx.font = mono(f, 400, 18);
  ctx.fillStyle = "rgba(255,244,228,0.5)";
  const place = EVENT.place;
  const placeW = trackedWidth(ctx, place, 4);
  tracked(ctx, place, cxLeft + colW - placeW, H - PAD - 8, 4);

  grain(ctx, W, H, 0.045);
  return canvas;
}

/* ============================================ Format A → link preview card */

/**
 * X renders a link card at 2:1-ish. Handing it the raw 1024² pfp would centre-crop
 * the ring off, so Format A gets its own 1200×675 preview composition.
 */
export function renderPfpShareCard(
  canvas: HTMLCanvasElement,
  pfp: HTMLCanvasElement,
  fonts: Fonts,
) {
  const W = OUT.cardW;
  const H = OUT.cardH;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const f = fonts;

  paintNight(ctx, W, H);
  bandedSun(
    ctx,
    W * 0.2,
    H * 0.1,
    170,
    linearRamp(ctx, 0, -80, 0, 240, [
      [0, C.gold],
      [1, C.magenta],
    ]),
    C.night,
  );
  ctx.fillStyle = "rgba(8,11,36,0.6)";
  ctx.fillRect(0, 0, W, H);
  palmFrond(ctx, -20, H * 0.3, 320, 0.4, C.teal, 0.16);
  waveLines(ctx, 40, H - 90, 360, 4, C.teal, 0.35);

  // The avatar, shown exactly as X will mask it.
  const size = 476;
  const ax = W - size - 78;
  const ay = (H - size) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 18;
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

  // Copy block
  const tx = 78;
  ctx.textBaseline = "alphabetic";
  ctx.font = mono(f, 700, 22);
  ctx.fillStyle = C.teal;
  tracked(ctx, "NEW PROFILE PICTURE", tx, 214, 6);

  ctx.font = disp(f, 900, 84);
  ctx.fillStyle = C.sand;
  ctx.fillText("HH GOA", tx, 310);
  ctx.fillStyle = linearRamp(ctx, tx, 320, tx + 300, 400);
  ctx.fillText("2026", tx, 396);

  ctx.font = mono(f, 700, 24);
  ctx.fillStyle = C.gold;
  tracked(ctx, EVENT.hashtag.toUpperCase(), tx, 462, 5);

  ctx.font = mono(f, 400, 20);
  ctx.fillStyle = "rgba(255,244,228,0.55)";
  tracked(ctx, `${EVENT.tagline} · ${EVENT.place}`, tx, 500, 4);

  grain(ctx, W, H, 0.045);
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
