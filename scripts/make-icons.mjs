/**
 * Builds the site icons from images/ (the HH Goa sunrise mark).
 *
 * The source is a screenshot with the sun sitting low and off-centre, so it is
 * cropped to a square around the sun before resizing — a naive centre crop puts
 * a lot of empty green above it and leaves the sun tiny at 32px.
 *
 *   node scripts/make-icons.mjs
 */

import { chromium } from "playwright";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Found by scanning rather than hardcoded: macOS screenshot filenames contain a
// narrow no-break space (U+202F) before AM/PM, which is easy to mangle.
const imagesDir = path.join(process.cwd(), "images");
const found = (await readdir(imagesDir)).find((f) => /\.(png|jpe?g)$/i.test(f));
if (!found) throw new Error(`No image found in ${imagesDir}`);
const SRC = path.join(imagesDir, found);
console.log(`source: images/${found}`);

// Square region around the sun, in source pixels (source is 1122×946).
const CROP = { x: 202, y: 246, w: 700, h: 700 };

const b = await chromium.launch();
const page = await b.newPage();

const dataUrl = `data:image/png;base64,${(await readFile(SRC)).toString("base64")}`;

/** Crops CROP out of the source and rescales it to `size`. */
async function render(size) {
  const out = await page.evaluate(
    async ({ dataUrl, crop, size }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const x = c.getContext("2d");
      x.imageSmoothingQuality = "high";
      x.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, size, size);
      return c.toDataURL("image/png");
    },
    { dataUrl, crop: CROP, size },
  );
  return Buffer.from(out.split(",")[1], "base64");
}

/** Wraps a PNG in an ICO container (PNG-in-ICO, supported since Vista). */
function ico(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width  (0 means 256)
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // palette size
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

const app = path.join(process.cwd(), "app");

// Next.js App Router picks these up by filename and emits the link tags itself.
// 256 rather than 512: the source carries paper grain that does not compress,
// and nothing requests an icon larger than ~192.
await writeFile(path.join(app, "icon.png"), await render(256));
await writeFile(path.join(app, "apple-icon.png"), await render(180));
await writeFile(path.join(app, "favicon.ico"), ico(await render(64), 64));

await b.close();
console.log("wrote app/icon.png, app/apple-icon.png, app/favicon.ico, public/icon-512.png");
