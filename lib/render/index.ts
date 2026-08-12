/**
 * HH Goa 2026 graphic renderers.
 *
 * Everything is drawn on a plain 2D canvas in the browser, so upload → finished
 * artwork is a single synchronous paint (a few milliseconds) with no server hop.
 *
 *   renderPfp   — Format A, 1024×1024 profile picture with a signal-yellow ring.
 *   renderCard  — Format B, 1200×675 builder pass.
 *   renderPfpShareCard — 1200×675 link-preview card wrapping a Format A pfp,
 *                        so the X card preview is never a cropped square.
 *
 * Colour discipline: deep green ground, one signal yellow, cream type. The
 * yellow is the loudest thing on the canvas and is spent only on the ring, the
 * pass header and the builder title.
 */

import { C, EVENT, OUT, SIGNAL } from "../brand";
import { badgeId } from "../titles";
import {
  arcText,
  bandedSun,
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
  /** Optional origin city, printed alongside the travel dates. */
  from?: string;
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

/* -------------------------------------------------------------- geometry */

const RING_OUTER = OUT.pfp / 2 - 6;
const RING_W = 62;
const RING_MID = RING_OUTER - RING_W / 2;
const PHOTO_R = RING_OUTER - RING_W + 2;

const HEADER_H = 58;
const PAD = 44;
const CARD_PHOTO_W = 372;

/**
 * The box the photo is drawn into, in output pixels. The UI needs it to convert
 * a drag in screen pixels into a focal-point change.
 */
export function photoWindow(format: "pfp" | "card") {
  return format === "pfp"
    ? { w: PHOTO_R * 2, h: PHOTO_R * 2 }
    : { w: CARD_PHOTO_W, h: OUT.cardH - (HEADER_H + PAD) - PAD };
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

/* ==================================================== Format B: builder pass */

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
  const { name, stack, from, title, seed = 0 } = opts.fields;

  ctx.clearRect(0, 0, W, H);
  paintGround(ctx, W, H);

  /* Ambience, kept to the right edge so it never sits behind type. */
  bandedSun(ctx, W * 0.94, HEADER_H + 26, 200, C.yellow, C.green);
  ctx.fillStyle = "rgba(7,80,41,0.78)";
  ctx.fillRect(0, HEADER_H, W, H - HEADER_H);
  palmFrond(ctx, W + 24, H * 0.22, 290, Math.PI - 0.5, C.yellow, 0.13);
  palmFrond(ctx, W * 0.99, H + 18, 250, -Math.PI / 2 - 0.5, C.lime, 0.1);
  waveLines(ctx, W * 0.53, H - 78, W * 0.43, 4, C.yellow, 0.22);

  /* Header band — the lanyard stripe of the pass. */
  ctx.save();
  ctx.fillStyle = C.yellow;
  ctx.fillRect(0, 0, W, HEADER_H);
  ctx.beginPath();
  ctx.rect(0, 0, W, HEADER_H);
  ctx.clip();
  ctx.fillStyle = C.green;
  ctx.font = mono(f, 700, 20);
  ctx.textBaseline = "middle";
  const marquee = `${EVENT.full}  ◆  ${EVENT.motto}  ◆  ${EVENT.hashtag.toUpperCase()}  ◆  ${EVENT.place}  ◆  `;
  const unit = trackedWidth(ctx, marquee, 3);
  for (let x = -24; x < W; x += unit) tracked(ctx, marquee, x, HEADER_H / 2 + 1, 3);
  ctx.restore();

  /* Photo panel. */
  const pw = CARD_PHOTO_W;
  const px = PAD;
  const py = HEADER_H + PAD;
  const ph = H - py - PAD;

  ctx.save();
  roundRect(ctx, px, py, pw, ph, 22);
  ctx.save();
  ctx.clip();
  coverDraw(ctx, opts.photo, px, py, pw, ph, opts.framing ?? DEFAULT_FRAMING);
  scrim(ctx, px, py, pw, ph, 0.7);
  ctx.restore();
  ctx.lineWidth = 5;
  ctx.strokeStyle = C.yellow;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.font = mono(f, 700, 19);
  ctx.fillStyle = C.yellow;
  ctx.textBaseline = "alphabetic";
  tracked(ctx, badgeId(name, stack, seed), px + 22, py + ph - 24, 3);
  ctx.restore();

  /* Right column. */
  const cxL = px + pw + 38;
  const colW = W - cxL - PAD;
  let y = py + 4;

  ctx.textBaseline = "alphabetic";

  ctx.font = mono(f, 700, 19);
  ctx.fillStyle = C.yellow;
  tracked(ctx, "BUILDER PASS", cxL, y + 14, 5);

  ctx.font = disp(f, 800, 42);
  ctx.fillStyle = C.cream;
  const wm = EVENT.wordmark;
  const wmW = trackedWidth(ctx, wm, 1);
  tracked(ctx, wm, cxL + colW - wmW - 62, y + 20, 1);

  ctx.save();
  roundRect(ctx, cxL + colW - 56, y - 8, 56, 36, 8);
  ctx.fillStyle = C.yellow;
  ctx.fill();
  ctx.font = mono(f, 700, 20);
  ctx.fillStyle = C.green;
  ctx.textAlign = "center";
  ctx.fillText("’26", cxL + colW - 28, y + 18);
  ctx.textAlign = "left";
  ctx.restore();

  y += 40;
  ctx.fillStyle = "rgba(255,251,232,0.22)";
  ctx.fillRect(cxL, y, colW, 2);

  /* Name — Imbue at size, shrinking to fit, ellipsised only as a last resort. */
  y += 86;
  fitFontSize(ctx, name || "Your Name", colW, (s) => disp(f, 800, s), 82, 38, 0);
  ctx.fillStyle = C.cream;
  ctx.fillText(ellipsize(ctx, name || "Your Name", colW), cxL, y);

  /* Stack / role. Extra leading here because Imbue's descenders run deep. */
  y += 52;
  const stackLine = (stack || "builder").toUpperCase();
  ctx.font = mono(f, 600, stackLine.length > 30 ? 18 : 23);
  ctx.fillStyle = C.yellow;
  tracked(ctx, ellipsize(ctx, stackLine, colW, 3), cxL, y, 3);

  /* Builder title — the payoff, so it gets the yellow. */
  y += 40;
  ctx.font = mono(f, 500, 16);
  ctx.fillStyle = "rgba(255,251,232,0.55)";
  tracked(ctx, "BUILDER TITLE", cxL, y, 4);

  y += 18;
  const chipH = 66;
  const titleText = title || "Low-Tide Shipper";
  const titleSize = fitFontSize(ctx, titleText, colW - 48, (s) => disp(f, 800, s), 40, 22, 0);
  const chipW = Math.min(colW, trackedWidth(ctx, titleText, 0) + 48);

  ctx.save();
  roundRect(ctx, cxL, y, chipW, chipH, 12);
  ctx.fillStyle = C.yellow;
  ctx.fill();
  ctx.fillStyle = C.green;
  ctx.font = disp(f, 800, titleSize);
  ctx.textBaseline = "middle";
  ctx.fillText(ellipsize(ctx, titleText, chipW - 36), cxL + 24, y + chipH / 2 + 2);
  ctx.restore();

  /* Travel stamps — what makes it a pass rather than a badge. */
  y += chipH + 34;
  ctx.textBaseline = "alphabetic";
  const third = colW / 3;
  const stamps: [string, string][] = [
    ["FROM", (from || "—").toUpperCase()],
    ["ARRIVES", EVENT.arrival],
    ["DEPARTS", EVENT.departure],
  ];
  stamps.forEach(([label, value], i) => {
    const x = cxL + i * third;
    ctx.font = mono(f, 500, 15);
    ctx.fillStyle = "rgba(255,251,232,0.5)";
    tracked(ctx, label, x, y, 4);
    ctx.font = mono(f, 700, 21);
    ctx.fillStyle = C.cream;
    tracked(ctx, ellipsize(ctx, value, third - 14, 1), x, y + 27, 1);
  });

  // Dotted rule, like a tear-off stub.
  ctx.save();
  ctx.strokeStyle = "rgba(254,225,1,0.45)";
  ctx.setLineDash([3, 7]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cxL, y + 46);
  ctx.lineTo(cxL + colW, y + 46);
  ctx.stroke();
  ctx.restore();

  /* Foot. */
  ctx.font = mono(f, 700, 18);
  ctx.fillStyle = C.yellow;
  tracked(ctx, EVENT.hashtag.toUpperCase(), cxL, H - PAD - 6, 3);

  ctx.font = mono(f, 500, 16);
  ctx.fillStyle = "rgba(255,251,232,0.5)";
  const foot = EVENT.place;
  const footW = trackedWidth(ctx, foot, 3);
  tracked(ctx, foot, cxL + colW - footW, H - PAD - 6, 3);

  grain(ctx, W, H, 0.04);
  return canvas;
}

/* ============================================ Format A → link preview card */

/**
 * X renders a link card at roughly 2:1. Handing it the raw 1024² pfp would
 * centre-crop the ring off, so Format A gets its own 1200×675 composition.
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
