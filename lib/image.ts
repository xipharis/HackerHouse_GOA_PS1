/**
 * Browser-side photo intake.
 *
 * Turns whatever the user picked — jpg, png, webp, or an iPhone HEIC — into a
 * correctly-oriented ImageBitmap, downscaled enough that the canvas work stays
 * instant even on a phone.
 */

/** Long edge we downscale to before compositing. 2048 is plenty for a 1200px card. */
const MAX_EDGE = 2048;

const HEIC_EXT = /\.(heic|heif|hif)$/i;
const HEIC_MIME = /^image\/(heic|heif)(-sequence)?$/i;

export class ImageError extends Error {}

function looksHeic(file: File) {
  return HEIC_MIME.test(file.type) || HEIC_EXT.test(file.name);
}

/**
 * Safari/iOS often hands us `type: ""` for HEIC, and some Androids mislabel it,
 * so we sniff the ISO-BMFF brand as well as the declared type.
 */
async function sniffHeic(file: File): Promise<boolean> {
  if (looksHeic(file)) return true;
  if (file.type && file.type !== "application/octet-stream") return false;
  try {
    const brand = new TextDecoder()
      .decode(await file.slice(8, 12).arrayBuffer())
      .replace(/\0/g, " ")
      .trim();
    return ["mif1", "msf1", "heic", "heix", "hevc", "hevx"].includes(brand);
  } catch {
    return false;
  }
}

/** Last-resort decode for browsers where createImageBitmap chokes on the blob. */
function decodeViaImgElement(blob: Blob): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = async () => {
      try {
        // <img> already applied EXIF orientation, so bake it in via a canvas.
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d")!.drawImage(img, 0, 0);
        resolve(await createImageBitmap(c));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError("Couldn't read that image."));
    };
    img.src = url;
  });
}

async function toBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    // Older Safari doesn't know the option; retry bare, then fall back to <img>.
    try {
      return await createImageBitmap(blob);
    } catch {
      return decodeViaImgElement(blob);
    }
  }
}

/** Shrink oversized camera output so every later draw is cheap. */
async function clamp(bmp: ImageBitmap): Promise<ImageBitmap> {
  const long = Math.max(bmp.width, bmp.height);
  if (long <= MAX_EDGE) return bmp;

  const scale = MAX_EDGE / long;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return createImageBitmap(c);
}

export async function loadPhoto(file: File): Promise<ImageBitmap> {
  if (file.size > 40 * 1024 * 1024) {
    throw new ImageError("That photo is over 40 MB — try a smaller one.");
  }

  let blob: Blob = file;

  if (await sniffHeic(file)) {
    // Loaded on demand: the libheif wasm is ~2 MB and most users never need it.
    const { heicTo } = await import("heic-to/next");
    try {
      // Decoding straight to a bitmap skips a full JPEG encode + re-decode of a
      // 12–48 MP image, which is most of the cost on this path.
      return await clamp(await heicTo({ blob: file, type: "bitmap" }));
    } catch {
      try {
        blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.94 });
      } catch {
        // Safari decodes HEIC natively, so a failed conversion isn't fatal there.
        blob = file;
      }
    }
  }

  try {
    return await clamp(await toBitmap(blob));
  } catch {
    throw new ImageError(
      "Couldn't read that photo. Try a JPG or PNG export of it.",
    );
  }
}
