/**
 * Low-level canvas helpers shared by the HH Goa renderers.
 * Everything here is pure drawing — no brand decisions, no layout.
 */

import { SUNSET } from "../brand";

export type Ctx = CanvasRenderingContext2D;

/** How the photo is placed inside its window. */
export type Framing = {
  /** 0..1 focal point, 0.5/0.5 = dead centre. */
  fx: number;
  fy: number;
  /** 1 = fill the window exactly (object-fit: cover). */
  zoom: number;
};

export const DEFAULT_FRAMING: Framing = { fx: 0.5, fy: 0.5, zoom: 1 };

/* ------------------------------------------------------------------ paths */

export function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/* -------------------------------------------------------------- gradients */

export function linearRamp(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: readonly [number, string][] = SUNSET,
) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

/**
 * Sunset ramp swept around a circle. Falls back to a linear ramp on the rare
 * engine without createConicGradient.
 */
export function conicRamp(ctx: Ctx, cx: number, cy: number, startAngle = -Math.PI / 2) {
  if (typeof ctx.createConicGradient !== "function") {
    return linearRamp(ctx, cx * 0.2, 0, cx * 1.8, cy * 2);
  }
  const g = ctx.createConicGradient(startAngle, cx, cy);
  // Loop the ramp back to its first colour so the seam is invisible.
  for (const [at, color] of SUNSET) g.addColorStop(at * 0.94, color);
  g.addColorStop(1, SUNSET[0][1]);
  return g;
}

/* ------------------------------------------------------------------ photo */

/**
 * Draws `bmp` to cover the given box (object-fit: cover), honouring the focal
 * point and zoom. Caller is responsible for clipping.
 */
export function coverDraw(
  ctx: Ctx,
  bmp: ImageBitmap,
  x: number,
  y: number,
  w: number,
  h: number,
  framing: Framing = DEFAULT_FRAMING,
) {
  const scale = Math.max(w / bmp.width, h / bmp.height) * Math.max(framing.zoom, 1);
  const dw = bmp.width * scale;
  const dh = bmp.height * scale;
  // Slack is how far the oversized image can slide before it exposes an edge.
  const dx = x + (w - dw) * clamp01(framing.fx);
  const dy = y + (h - dh) * clamp01(framing.fy);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, dx, dy, dw, dh);
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/* ------------------------------------------------------------------- text */

/** Draws text with manual letter-spacing; returns the width consumed. */
export function tracked(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  spacing: number,
  draw = true,
): number {
  let cursor = x;
  for (const ch of text) {
    if (draw) ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
  return Math.max(0, cursor - x - spacing);
}

export function trackedWidth(ctx: Ctx, text: string, spacing: number) {
  return tracked(ctx, text, 0, 0, spacing, false);
}

/**
 * Largest font size (binary-search free, just a shrink loop) at which `text`
 * fits `maxWidth`. Keeps long names on one line instead of overflowing.
 */
export function fitFontSize(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  font: (size: number) => string,
  max: number,
  min: number,
  spacing = 0,
): number {
  let size = max;
  while (size > min) {
    ctx.font = font(size);
    if (trackedWidth(ctx, text, spacing) <= maxWidth) break;
    size -= 1;
  }
  ctx.font = font(size);
  return size;
}

/** Truncates with an ellipsis once shrinking alone can't save it. */
export function ellipsize(ctx: Ctx, text: string, maxWidth: number, spacing = 0) {
  if (trackedWidth(ctx, text, spacing) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && trackedWidth(ctx, `${t}…`, spacing) > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t.trimEnd()}…`;
}

/** Lays text around a circle. `flip` reads it right-way-up along a bottom arc. */
export function arcText(
  ctx: Ctx,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  centerAngle: number,
  spacing: number,
  flip = false,
) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  const arc = total / radius;

  let angle = centerAngle + (flip ? arc / 2 : -arc / 2);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < chars.length; i++) {
    const step = widths[i] / radius;
    const a = angle + (flip ? -step / 2 : step / 2);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.rotate(flip ? a - Math.PI / 2 : a + Math.PI / 2);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    angle += flip ? -step : step;
  }
  ctx.restore();
}

/* ------------------------------------------------------------- atmosphere */

let grainTile: HTMLCanvasElement | null = null;

/** A cached noise tile, pattern-filled — cheap film grain over flat gradients. */
export function grain(ctx: Ctx, w: number, h: number, alpha = 0.05) {
  if (!grainTile) {
    const size = 160;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const data = g.createImageData(size, size);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    g.putImageData(data, 0, 0);
    grainTile = c;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "overlay";
  const pattern = ctx.createPattern(grainTile, "repeat");
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

/** A retro sun disc sliced by horizontal bands that thin out toward the top. */
export function bandedSun(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  fill: string | CanvasGradient,
  bandColor: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  ctx.fillStyle = bandColor;
  // Bands get taller and closer together toward the bottom of the disc.
  let y = cy - r * 0.05;
  let gap = r * 0.1;
  let thickness = r * 0.02;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, thickness);
    y += gap + thickness;
    gap *= 0.93;
    thickness *= 1.22;
  }
  ctx.restore();
}

/**
 * A palm frond silhouette: one arching spine with leaflets down both sides.
 * Drawn from the frond's base, pointing along +x before rotation.
 */
export function palmFrond(
  ctx: Ctx,
  x: number,
  y: number,
  length: number,
  rotation: number,
  color: string,
  alpha = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  const curve = length * 0.34; // how much the spine arcs
  const spine = (t: number) => ({
    x: length * t,
    y: -curve * Math.sin(t * Math.PI * 0.62),
  });

  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.5, length * 0.012);
  ctx.beginPath();
  for (let t = 0; t <= 1.001; t += 0.05) {
    const p = spine(t);
    t === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  const leaflets = 15;
  for (let i = 1; i <= leaflets; i++) {
    const t = i / (leaflets + 1);
    const base = spine(t);
    const next = spine(Math.min(1, t + 0.02));
    const dir = Math.atan2(next.y - base.y, next.x - base.x);
    // Leaflets are longest mid-frond and taper at both ends.
    const leafLen = length * 0.3 * Math.sin(t * Math.PI) ** 0.7;

    for (const side of [-1, 1] as const) {
      const spread = dir + side * (Math.PI / 2.5) - side * t * 0.5;
      const tipX = base.x + Math.cos(spread) * leafLen;
      const tipY = base.y + Math.sin(spread) * leafLen;
      const ctrlX = base.x + Math.cos(spread - side * 0.5) * leafLen * 0.7;
      const ctrlY = base.y + Math.sin(spread - side * 0.5) * leafLen * 0.7;

      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.quadraticCurveTo(
        ctrlX + Math.cos(dir) * leafLen * 0.16,
        ctrlY + Math.sin(dir) * leafLen * 0.16,
        base.x + Math.cos(dir) * leafLen * 0.2,
        base.y + Math.sin(dir) * leafLen * 0.2,
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Stacked sine lines — the ocean under the sun. */
export function waveLines(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  rows: number,
  color: string,
  alpha = 0.5,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let r = 0; r < rows; r++) {
    const rowY = y + r * 14;
    ctx.lineWidth = 2 + r * 0.35;
    ctx.globalAlpha = alpha * (1 - r / (rows + 2));
    ctx.beginPath();
    for (let px = 0; px <= w; px += 6) {
      const py = rowY + Math.sin(px / 34 + r * 0.8) * (3 + r * 0.6);
      px === 0 ? ctx.moveTo(x + px, py) : ctx.lineTo(x + px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}
