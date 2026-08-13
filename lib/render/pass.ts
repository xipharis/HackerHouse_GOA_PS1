/**
 * Format B — the HH Goa 2026 builder pass.
 *
 * A portrait 1080×1350 card drawn as a physical object: pink edge, cream stock,
 * a printed coast panel across the head, a punched-out photo, and a stub with a
 * barcode. Every measurement below is expressed against a 1080-wide card and
 * scaled by `v`, so the same routine draws the full-size pass and the small copy
 * that sits inside the link-preview card.
 *
 * Type is the pass's own: Playfair for the lockup and the name, Cabinet Grotesk
 * for the loud all-caps lines, JetBrains Mono for the small printed labels.
 */

import { EVENT, OUT, PASS } from "../brand";
import { badgeId } from "../titles";
import { coastImage } from "./assets";
import { coverDraw, Ctx, DEFAULT_FRAMING, Framing, roundRect } from "./paint";

export type PassFonts = { serif: string; grotesk: string; mono: string };

export type PassFields = {
  name: string;
  stack: string;
  /** Where the builder is flying in from. Printed as DEPARTING FROM. */
  departure?: string;
  /** Optional crew, stamped into the top-right corner of the pass. */
  team?: string;
  title: string;
  seed?: number;
};

export type PassOpts = {
  photo: ImageBitmap | null;
  fonts: PassFonts;
  framing?: Framing;
  fields: PassFields;
};

/** Diameter of the punched-out photo hole, in card units. */
const PHOTO_D = 360;

/** The photo window, in output pixels, for turning a drag into a focal point. */
export function passPhotoWindow() {
  return { w: PHOTO_D, h: PHOTO_D };
}

/* ------------------------------------------------------------------- type */

/** Draws letter-spaced text with its own alignment; returns the width drawn. */
function run(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: "left" | "center" | "right" = "left",
) {
  const chars = [...text];
  const width =
    chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) +
    spacing * Math.max(0, chars.length - 1);

  let cursor = x;
  if (align === "right") cursor = x - width;
  if (align === "center") cursor = x - width / 2;
  for (const ch of chars) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
  return width;
}

/**
 * Shrinks to fit, then truncates if shrinking alone wasn't enough. Leaves the
 * chosen font set on the context.
 */
function fitText(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  max: number,
  min: number,
  weight: number,
  family: string,
  /** Tracking the text will be drawn with, which widens it beyond measureText. */
  spacing = 0,
) {
  const width = (t: string) =>
    ctx.measureText(t).width + spacing * Math.max(0, [...t].length - 1);

  let size = max;
  const set = (s: number) => (ctx.font = `${weight} ${s}px ${family}`);
  for (set(size); width(text) > maxWidth && size > min; ) {
    set((size -= 2));
  }

  let out = text;
  if (width(out) > maxWidth) {
    while (out.length > 1 && width(`${out}...`) > maxWidth) {
      out = out.slice(0, -1);
    }
    out = `${out.trimEnd()}...`;
  }
  return { text: out, size };
}

/* ------------------------------------------------------------ decorations */

/** Stacked bezier swells — the sea, and the ruled lines under the divider. */
function waves(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  lineWidth: number,
  rows = 9,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const rowY = y + t * h;
    // Swells flatten out toward the horizon.
    const swell = h * 0.06 * (1 - t * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, rowY);
    ctx.bezierCurveTo(
      x + w * 0.3,
      rowY - swell,
      x + w * 0.62,
      rowY + swell,
      x + w,
      rowY - swell * 0.4,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** The retro sun: a disc sliced by bands that thicken toward the bottom. */
function bandedSun(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  band: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = band;
  for (let i = 1; i <= 7; i++) {
    const t = i / 8;
    ctx.fillRect(cx - r, cy - r + t * r * 2, r * 2, r * 0.055 * (0.5 + t));
  }
  ctx.restore();
}

/** A line-art palm: one leaning trunk with five fronds off the top. */
function palm(
  ctx: Ctx,
  x: number,
  baseY: number,
  size: number,
  color: string,
  lineWidth: number,
  dir: 1 | -1 = 1,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(
    x + dir * size * 0.1,
    baseY - size * 0.55,
    x + dir * size * 0.16,
    baseY - size,
  );
  ctx.stroke();

  const cx = x + dir * size * 0.16;
  const cy = baseY - size;
  const reach = size * 0.34;
  for (let i = 0; i < 5; i++) {
    const angle = Math.PI + (i / 4) * Math.PI;
    const dx = Math.cos(angle) * reach;
    const dy = Math.sin(angle) * reach * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + dx * 0.55, cy + dy - reach * 0.3, cx + dx, cy + dy);
    ctx.stroke();
  }
  ctx.restore();
}

/** A single upright leaf with a midrib. */
function leaf(
  ctx: Ctx,
  x: number,
  baseY: number,
  size: number,
  color: string,
  lineWidth: number,
  dir: 1 | -1 = 1,
) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate((11 * dir * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  const bow = size * 0.26;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-bow, -size * 0.28, -bow, -size * 0.74, 0, -size);
  ctx.bezierCurveTo(bow, -size * 0.74, bow, -size * 0.28, 0, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.1);
  ctx.lineTo(0, -size * 0.9);
  ctx.stroke();
  ctx.restore();
}

/** A beach umbrella: scalloped hem, domed canopy, two ribs and a pole. */
function umbrella(
  ctx: Ctx,
  cx: number,
  baseY: number,
  size: number,
  color: string,
  lineWidth: number,
) {
  const topY = baseY - size;
  const half = size * 0.62;
  const hem = topY + size * 0.24;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(cx - half, hem);
  for (let i = 0; i < 4; i++) {
    const from = cx - half + (i * half * 2) / 4;
    const to = cx - half + ((i + 1) * half * 2) / 4;
    ctx.quadraticCurveTo((from + to) / 2, hem + size * 0.1, to, hem);
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - half, hem);
  ctx.quadraticCurveTo(cx, topY - size * 0.16, cx + half, hem);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - half * 0.5, hem + size * 0.04);
  ctx.lineTo(cx, topY);
  ctx.moveTo(cx + half * 0.5, hem + size * 0.04);
  ctx.lineTo(cx, topY);
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx, baseY);
  ctx.stroke();
  ctx.restore();
}

/** A martini glass with a stirrer and a wedge on the rim. */
function cocktail(
  ctx: Ctx,
  x: number,
  baseY: number,
  size: number,
  color: string,
  lineWidth: number,
) {
  const bowl = size * 0.46;
  const rimY = baseY - size;
  const half = bowl * 0.62;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(x - half, rimY);
  ctx.lineTo(x + half, rimY);
  ctx.lineTo(x, rimY + bowl);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, rimY + bowl);
  ctx.lineTo(x, baseY);
  ctx.moveTo(x - size * 0.2, baseY);
  ctx.lineTo(x + size * 0.2, baseY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + half * 0.25, rimY + bowl * 0.45);
  ctx.lineTo(x + half * 1.1, rimY - size * 0.22);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x - half * 0.92, rimY, size * 0.11, Math.PI * 0.15, Math.PI * 1.15);
  ctx.stroke();
  ctx.restore();
}

/** The printer's dot grid in the corner of the coast panel. */
function dotGrid(
  ctx: Ctx,
  x: number,
  y: number,
  step: number,
  r: number,
  color: string,
) {
  ctx.save();
  ctx.fillStyle = color;
  for (let col = 0; col < 9; col++) {
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      ctx.arc(x + col * step, y + row * step, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* -------------------------------------------------------------- the stub */

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** xorshift32 — same serial always prints the same bars. */
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

function barcode(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  serial: string,
  color: string,
) {
  const rand = rng(hash(serial));
  const unit = w / 90;
  ctx.save();
  ctx.fillStyle = color;
  let cursor = x;
  while (cursor < x + w) {
    const bar = (0.4 + rand() * 1.9) * unit;
    const gap = (0.4 + rand() * 1.1) * unit;
    if (cursor + bar > x + w) break;
    ctx.fillRect(cursor, y, bar, h);
    cursor += bar + gap;
  }
  ctx.restore();
}

/** Fixed-seed speckle, so the "print texture" never shimmers between paints. */
function speckle(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const rand = rng(0x9e3779b9);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = PASS.ink;
  const count = Math.floor((w * h) / 1100);
  for (let i = 0; i < count; i++) {
    ctx.fillRect(x + rand() * w, y + rand() * h, 1.4, 1.4);
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- the pass */

/**
 * Draws the pass into an arbitrary box. `w` drives every dimension, so the same
 * code paints the 1080-wide download and the ~427-wide copy on the link card.
 */
export function drawPass(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: PassOpts,
) {
  const v = w / OUT.cardW;
  const f = opts.fonts;
  const { name, stack, departure, team, title, seed = 0 } = opts.fields;
  const serif = (weight: number, size: number) => `${weight} ${size * v}px ${f.serif}`;
  const grot = (weight: number, size: number) => `${weight} ${size * v}px ${f.grotesk}`;
  const mono = (weight: number, size: number) => `${weight} ${size * v}px ${f.mono}`;

  const margin = 74 * v;
  const innerW = w - margin * 2;

  ctx.save();
  roundRect(ctx, x, y, w, h, 26 * v);
  ctx.clip();

  /* Card stock: pink edge, cream body, a thin yellow keyline inside it. */
  ctx.fillStyle = PASS.pink;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PASS.cream;
  roundRect(ctx, x + 18 * v, y + 18 * v, w - 36 * v, h - 36 * v, 16 * v);
  ctx.fill();
  ctx.strokeStyle = PASS.yellow;
  ctx.lineWidth = 3 * v;
  roundRect(ctx, x + 30 * v, y + 30 * v, w - 60 * v, h - 60 * v, 12 * v);
  ctx.stroke();

  /* ------------------------------------------------ coast panel + lockup */

  const hx = x + 40 * v;
  const hy = y + 40 * v;
  const hw = w - 80 * v;
  const hh = 400 * v;

  ctx.save();
  roundRect(ctx, hx, hy, hw, hh, 8 * v);
  ctx.clip();
  ctx.fillStyle = PASS.green;
  ctx.fillRect(hx, hy, hw, hh);

  // The photo is knocked back behind a green wash so the lockup stays readable
  // whether or not it arrived in time.
  const coast = coastImage();
  if (coast) {
    ctx.save();
    ctx.globalAlpha = 0.58;
    ctx.drawImage(coast, hx, hy, hw, hh);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.44;
    ctx.fillStyle = PASS.green;
    ctx.fillRect(hx, hy, hw, hh);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = 0.3;
  waves(ctx, hx, hy + hh * 0.42, hw, hh * 0.55, PASS.yellow, 2 * v, 8);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.85;
  bandedSun(ctx, hx + hw * 0.845, hy + hh * 0.5, 56 * v, PASS.yellow, PASS.green);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.5;
  palm(ctx, hx + hw * 0.7, hy + hh * 0.66, 92 * v, PASS.yellow, 2.4 * v, 1);
  palm(ctx, hx + hw * 0.94, hy + hh * 0.72, 66 * v, PASS.yellow, 2.2 * v, -1);
  ctx.restore();

  const teamName = team?.trim();
  if (!teamName) {
    // Printer's dots, there to keep the corner from reading as empty. The team
    // stamp below takes that corner when there is one.
    ctx.save();
    ctx.globalAlpha = 0.55;
    dotGrid(ctx, hx + hw * 0.72, hy + 30 * v, 13 * v, 2 * v, PASS.pink);
    ctx.restore();
  }

  const tx = hx + 34 * v;
  ctx.textBaseline = "alphabetic";

  /* The team stamp — mirrors the lockup on the left, set hard to the right
     margin so it reads as the corner it's stamped into. */
  if (teamName) {
    const rx = hx + hw - 34 * v;
    ctx.fillStyle = "rgba(240,232,208,0.72)";
    ctx.font = mono(400, 15);
    run(ctx, "TEAM", rx, hy + 58 * v, 2.2 * v, "right");

    const fit = fitText(ctx, teamName.toUpperCase(), 360 * v, 26 * v, 15 * v, 700, f.grotesk, v);
    ctx.fillStyle = PASS.yellow;
    run(ctx, fit.text, rx, hy + 92 * v, v, "right");
  }

  ctx.fillStyle = PASS.yellow;
  ctx.font = grot(700, 34);
  run(ctx, EVENT.full, tx, hy + 62 * v, 2 * v);

  ctx.fillStyle = PASS.cream;
  ctx.font = mono(400, 17);
  run(ctx, "OFFICIAL BUILDER PASS", tx, hy + 90 * v, 2.2 * v);

  ctx.font = serif(900, 78);
  ctx.fillStyle = PASS.cream;
  run(ctx, "HACKER", tx, hy + 188 * v, v);
  ctx.fillStyle = PASS.pink;
  const houseW = run(ctx, "HOUSE", tx, hy + 264 * v, v);
  ctx.fillStyle = PASS.yellow;
  ctx.font = serif(900, 78 * 0.72);
  run(ctx, "GOA", tx + houseW + 20 * v, hy + 264 * v, v);

  ctx.fillStyle = PASS.yellow;
  ctx.font = mono(700, 17);
  run(ctx, "CODE · CONNECT · CHILL · REPEAT", tx, hy + 322 * v, 1.6 * v);
  ctx.restore();

  /* ----------------------------------------------- the beach-scene divider */

  const rule = 2.4 * v;
  const left = x + margin;
  const right = x + w - margin;
  const baseline = y + 690 * v;

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = PASS.green;
  ctx.lineWidth = rule;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(left, baseline);
  ctx.lineTo(right, baseline);
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.16;
  waves(ctx, left, baseline + 13 * v, w - margin * 2, 26 * v, PASS.green, 2 * v, 3);
  ctx.restore();

  palm(ctx, left + 54 * v, baseline, 152 * v, PASS.green, rule, 1);
  palm(ctx, left + 132 * v, baseline, 108 * v, PASS.green, rule * 0.9, -1);
  leaf(ctx, left + 208 * v, baseline, 96 * v, PASS.green, rule * 0.9, 1);
  umbrella(ctx, right - 118 * v, baseline, 132 * v, PASS.green, rule);
  cocktail(ctx, right - 38 * v, baseline, 64 * v, PASS.green, rule * 0.9);
  ctx.restore();

  /* ------------------------------------------------------- punched photo */

  const pcx = x + 540 * v;
  const pcy = y + 540 * v;
  const pr = (PHOTO_D / 2) * v;

  ctx.fillStyle = PASS.pink;
  ctx.beginPath();
  ctx.arc(pcx, pcy, pr + 20 * v, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PASS.yellow;
  ctx.beginPath();
  ctx.arc(pcx, pcy, pr + 11 * v, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(pcx, pcy, pr, 0, Math.PI * 2);
  ctx.clip();
  if (opts.photo) {
    coverDraw(
      ctx,
      opts.photo,
      pcx - pr,
      pcy - pr,
      pr * 2,
      pr * 2,
      opts.framing ?? DEFAULT_FRAMING,
    );
  } else {
    ctx.fillStyle = PASS.green;
    ctx.fillRect(pcx - pr, pcy - pr, pr * 2, pr * 2);
    ctx.save();
    ctx.globalAlpha = 0.4;
    waves(ctx, pcx - pr, pcy - pr * 0.2, pr * 2, pr * 1.2, PASS.yellow, 2 * v, 6);
    ctx.restore();
    ctx.fillStyle = PASS.cream;
    ctx.font = mono(400, 21);
    ctx.textBaseline = "middle";
    run(ctx, "YOUR PHOTO", pcx, pcy, 2 * v, "center");
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  /* ------------------------------------------------------------ identity */

  ctx.fillStyle = PASS.green;
  const nameFit = fitText(
    ctx,
    name.trim() || "Your name",
    innerW - 40 * v,
    76 * v,
    38 * v,
    900,
    f.serif,
  );
  ctx.textAlign = "center";
  ctx.fillText(nameFit.text, x + w / 2, y + 812 * v);
  ctx.textAlign = "left";

  const role = stack.trim();
  if (role) {
    ctx.fillStyle = PASS.pinkDeep;
    ctx.font = mono(700, 22);
    run(ctx, role.toUpperCase(), x + w / 2, y + 850 * v, 2.4 * v, "center");
  }

  /* Builder title — the payoff, so it gets the yellow slab. */
  const titleText = title.trim();
  if (titleText) {
    const ty = y + 880 * v;
    ctx.fillStyle = PASS.yellow;
    roundRect(ctx, x + margin, ty, innerW, 106 * v, 14 * v);
    ctx.fill();

    ctx.fillStyle = PASS.green;
    ctx.font = mono(400, 16);
    run(ctx, "BUILDER TITLE", x + w / 2, ty + 36 * v, 2.4 * v, "center");

    const fit = fitText(
      ctx,
      titleText.toUpperCase(),
      innerW - 56 * v,
      36 * v,
      20 * v,
      800,
      f.grotesk,
      1.6 * v,
    );
    ctx.fillStyle = PASS.ink;
    run(ctx, fit.text, x + w / 2, ty + 78 * v, 1.6 * v, "center");
  }

  /* ---------------------------------------------------------- the details */

  const boxY = y + 1008 * v;
  const boxH = 176 * v;
  ctx.fillStyle = PASS.stock;
  roundRect(ctx, x + margin, boxY, innerW, boxH, 14 * v);
  ctx.fill();
  ctx.strokeStyle = PASS.green;
  ctx.lineWidth = 2 * v;
  roundRect(ctx, x + margin, boxY, innerW, boxH, 14 * v);
  ctx.stroke();

  const colL = x + margin + 30 * v;
  const colR = x + w / 2 + 16 * v;
  /** Width a right-column entry has before it runs into the panel edge. */
  const colW = x + w - margin - 30 * v - colR;

  const entry = (label: string, value: string, ex: number, ey: number) => {
    ctx.fillStyle = PASS.green;
    ctx.font = mono(400, 14);
    run(ctx, label, ex, ey, 2.2 * v);
    ctx.fillStyle = PASS.ink;
    // Only the typed-in values can be long, so every value is fitted rather
    // than trusted.
    const fit = fitText(ctx, value, colW, 21 * v, 13 * v, 700, f.grotesk, 0.6 * v);
    run(ctx, fit.text, ex, ey + 30 * v, 0.6 * v);
  };

  // A 2×2 grid: where the event is against where you're coming from, then the
  // dates against the mission. The motto that used to sit in the fourth slot is
  // already carried by MISSION and the header strapline.
  entry("BASE CAMP", EVENT.place, colL, boxY + 44 * v);
  entry(
    "DEPARTING FROM",
    (departure?.trim() || "—").toUpperCase(),
    colR,
    boxY + 44 * v,
  );
  entry("DATES", EVENT.windowShort, colL, boxY + 114 * v);
  entry("MISSION", "BUILD · SHIP · REPEAT", colR, boxY + 114 * v);

  /* ------------------------------------------------------------- the stub */

  const stubY = y + 1214 * v;
  const serial = badgeId(name, stack, seed);
  barcode(ctx, x + margin, stubY, 246 * v, 46 * v, serial, PASS.ink);
  ctx.fillStyle = PASS.green;
  ctx.font = mono(400, 14);
  run(ctx, serial, x + margin, stubY + 68 * v, 1.6 * v);

  const pillW = 300 * v;
  const pillX = x + w - margin - pillW;
  ctx.fillStyle = PASS.pink;
  roundRect(ctx, pillX, stubY - 4 * v, pillW, 56 * v, 28 * v);
  ctx.fill();
  ctx.fillStyle = PASS.cream;
  ctx.font = grot(800, 24);
  ctx.textBaseline = "middle";
  run(ctx, EVENT.hashtag.toUpperCase(), pillX + pillW / 2, stubY + 24 * v, 1.4 * v, "center");
  ctx.textBaseline = "alphabetic";

  speckle(ctx, x, y, w, h);
  ctx.restore();
}

/** The downloadable pass, 1080×1350. */
export function renderPass(canvas: HTMLCanvasElement, opts: PassOpts) {
  const W = OUT.cardW;
  const H = OUT.cardH;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  drawPass(ctx, 0, 0, W, H, opts);
  return canvas;
}

/**
 * The 1200×630 link preview. A portrait pass handed to X as-is would be
 * centre-cropped to a letterbox strip, so it gets laid on a green ground beside
 * the lockup instead.
 */
export function renderPassShareCard(canvas: HTMLCanvasElement, opts: PassOpts) {
  const W = OUT.ogW;
  const H = OUT.ogH;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const f = opts.fonts;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = PASS.green;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.25;
  waves(ctx, 0, H * 0.3, W, H * 0.7, PASS.yellow, 2, 10);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.9;
  bandedSun(ctx, W * 0.88, H * 0.24, 62, PASS.yellow, PASS.green);
  ctx.restore();

  const cardH = H - 96;
  const cardW = cardH * (OUT.cardW / OUT.cardH);
  ctx.save();
  ctx.shadowColor = "rgba(0, 26, 18, 0.5)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 16;
  drawPass(ctx, 72, 48, cardW, cardH, opts);
  ctx.restore();

  const tx = 72 + cardW + 68;
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 62px ${f.serif}`;
  ctx.fillStyle = PASS.cream;
  ctx.fillText("HACKER", tx, H / 2 - 46);
  ctx.fillStyle = PASS.pink;
  ctx.fillText("HOUSE", tx, H / 2 + 22);

  ctx.fillStyle = PASS.yellow;
  ctx.font = `700 26px ${f.mono}`;
  run(ctx, `GOA · ${EVENT.windowShort}`, tx, H / 2 + 66, 2);

  ctx.fillStyle = PASS.cream;
  ctx.font = `800 30px ${f.grotesk}`;
  run(ctx, EVENT.hashtag.toUpperCase(), tx, H / 2 + 124, 1.6);

  return canvas;
}
