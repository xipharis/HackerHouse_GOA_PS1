/**
 * Image assets the renderers draw in.
 *
 * A paint is synchronous, so anything it needs has to already be decoded. The
 * coast photo is loaded once, cached, and simply skipped if it hasn't landed
 * yet — the pass header falls back to flat green, which is a legitimate look
 * rather than a broken one.
 */

let coastPromise: Promise<HTMLImageElement | null> | null = null;
let coast: HTMLImageElement | null = null;

/** Kick off (or join) the load. Resolves to null if the image can't be had. */
export function ensureCoast(): Promise<HTMLImageElement | null> {
  if (coastPromise) return coastPromise;
  if (typeof document === "undefined") return Promise.resolve(null);
  coastPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      coast = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = "/goa-coast.webp";
  });
  return coastPromise;
}

/** The decoded coast photo, or null if it isn't ready. Never throws. */
export function coastImage(): HTMLImageElement | null {
  return coast;
}
