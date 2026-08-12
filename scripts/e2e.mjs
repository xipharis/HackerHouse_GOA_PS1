/**
 * End-to-end smoke test for the generator.
 *
 * Drives a real browser through the whole required flow — upload (incl. HEIC),
 * render, download, share — for both formats and several photo aspect ratios,
 * and writes the resulting PNGs to out/ so the artwork itself can be eyeballed.
 *
 *   node scripts/e2e.mjs [baseUrl]
 */

import { chromium, devices } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3001";
const OUT = path.join(process.cwd(), ".e2e-out");
const FIX = path.join(process.cwd(), ".fixtures");

const fail = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  fail.push(m);
  console.log(`  ✗ ${m}`);
};

/** Reads intrinsic dimensions from raw PNG or JPEG bytes. */
function imageSize(buf) {
  if (buf.subarray(0, 4).toString("hex") === "89504e47") {
    return { type: "png", w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      // SOF0..SOF15, excluding the non-frame markers DHT/JPG/DAC.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: "jpeg", h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

async function saveCanvas(page, selector, file) {
  const dataUrl = await page.evaluate(
    (sel) => document.querySelector(sel)?.toDataURL("image/png") ?? null,
    selector,
  );
  if (!dataUrl) return null;
  const buf = Buffer.from(dataUrl.split(",")[1], "base64");
  await writeFile(path.join(OUT, file), buf);
  return buf;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  /* ------------------------------------------------- desktop: both formats */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(BASE, { waitUntil: "networkidle" });

  for (const [fixture, label] of [
    ["person.jpg", "portrait-subject-1080x1620"],
    ["tall.jpg", "portrait-1200x1800"],
    ["wide.jpg", "landscape-1600x700"],
    ["square.png", "square-png-1400"],
    ["iphone12mp.heic", "iphone-heic-12MP-4032x3024"],
    ["iphone.heic", "iphone-heic-36MP-6016x6016"],
  ]) {
    console.log(`\n[${label}]`);
    // Fingerprint the current pixels so we can tell a real repaint from the
    // previous fixture's artwork still sitting on the canvas.
    const before = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      if (!c || c.width !== 1024) return "none";
      return c.getContext("2d").getImageData(400, 400, 60, 60).data.join(",");
    });

    const t0 = Date.now();
    await page.setInputFiles('input[type="file"]', path.join(FIX, fixture));
    await page.waitForFunction(
      (prev) => {
        const c = document.querySelector("canvas");
        if (!c || c.width !== 1024) return false;
        return c.getContext("2d").getImageData(400, 400, 60, 60).data.join(",") !== prev;
      },
      before,
      { timeout: 20000 },
    );
    const ms = Date.now() - t0;

    const dims = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      return { w: c?.width, h: c?.height };
    });
    if (dims.w === 1024 && dims.h === 1024) ok(`pfp rendered 1024² in ${ms}ms`);
    else bad(`pfp render failed (${dims.w}×${dims.h}) — ${label}`);
    if (ms > 5000) bad(`slow: ${ms}ms for ${label}`);

    // Non-blank check: sample the centre of the photo area.
    const ink = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const d = c.getContext("2d").getImageData(512, 400, 40, 40).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return sum / (d.length / 4);
    });
    if (ink > 12) ok(`photo pixels present (avg ${ink.toFixed(0)})`);
    else bad(`canvas looks blank for ${label}`);

    await saveCanvas(page, "canvas", `pfp-${label}.png`);
  }

  /* ---------------------------------------------------------- Format B */
  console.log("\n[format B: builder id]");
  await page.getByRole("button", { name: /Builder ID/ }).click();
  await page.getByRole("textbox").first().fill("Aparna Krishnamurthy");
  await page.getByRole("textbox").nth(1).fill("Rust · distributed systems");
  await page.waitForFunction(() => document.querySelector("canvas")?.width === 1200);
  await page.waitForTimeout(150);

  const cardDims = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    return { w: c.width, h: c.height };
  });
  cardDims.w === 1200 && cardDims.h === 675
    ? ok("card rendered 1200×675")
    : bad(`card wrong size ${cardDims.w}×${cardDims.h}`);

  const title = await page.getByRole("textbox").nth(2).inputValue();
  /rust|borrow|zero-cost|memory-safe/i.test(title)
    ? ok(`stack-aware builder title: "${title}"`)
    : bad(`title ignored the stack: "${title}"`);

  await saveCanvas(page, "canvas", "card-filled.png");

  // A very long name must shrink/ellipsize rather than overflow.
  await page.getByRole("textbox").first().fill("Bartholomew Vanderbilt-Fitzgerald III");
  await page.waitForTimeout(150);
  await saveCanvas(page, "canvas", "card-longname.png");
  ok("long-name variant captured");

  /* ------------------------------------------------------------ download */
  const dl = page.waitForEvent("download", { timeout: 10000 });
  await page.getByRole("button", { name: "Download PNG" }).click();
  try {
    const d = await dl;
    const p = path.join(OUT, "downloaded.png");
    await d.saveAs(p);
    /\.png$/.test(d.suggestedFilename())
      ? ok(`download works → ${d.suggestedFilename()}`)
      : bad(`bad download filename ${d.suggestedFilename()}`);
  } catch (e) {
    bad(`download failed: ${e.message}`);
  }

  /* -------------------------------------------------- share, both formats */
  // Stub x.com so the test captures each intent URL as-issued, before any
  // redirect to a login flow can rewrite it.
  const intents = [];
  await ctx.route(/x\.com/, (route) => {
    intents.push(route.request().url());
    route.fulfill({ contentType: "text/html", body: "<h1>stub</h1>" });
  });

  async function shareFlow(label) {
    console.log(`\n[share: ${label}]`);
    const seen = intents.length;
    const popupPromise = page.waitForEvent("popup", { timeout: 25000 });
    await page.getByRole("button", { name: "Share to X" }).click();

    let shareUrl = null;
    try {
      const popup = await popupPromise;
      await page.waitForFunction((n) => true, seen);
      await popup.waitForURL(/x\.com/, { timeout: 25000 });
      const u = new URL(intents[seen] ?? popup.url());
      /\/intent\/(post|tweet)/.test(u.pathname)
        ? ok("opens the X compose intent")
        : bad(`unexpected intent path: ${u.pathname}`);

      shareUrl = u.searchParams.get("url");
      const text = u.searchParams.get("text") ?? "";
      /#FrameInGoa/i.test(text)
        ? ok("caption carries #FrameInGoa")
        : bad(`hashtag missing from caption: ${text}`);
      text.length > 20
        ? ok(`caption pre-filled: ${JSON.stringify(text.slice(0, 52))}…`)
        : bad("caption empty");
      shareUrl ? ok(`share link: ${shareUrl}`) : bad("no share url in intent");
      await popup.close();
    } catch (e) {
      bad(`share to X failed (${label}): ${e.message}`);
      return;
    }

    /* OG tags must resolve to the real graphic, not a default thumbnail. */
    const og = await ctx.newPage();
    await og.goto(shareUrl, { waitUntil: "networkidle" });
    const meta = await og.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll("meta")]
          .filter(
            (m) =>
              m.getAttribute("property")?.startsWith("og:") ||
              m.getAttribute("name")?.startsWith("twitter:"),
          )
          .map((m) => [m.getAttribute("property") ?? m.getAttribute("name"), m.content]),
      ),
    );

    meta["twitter:card"] === "summary_large_image"
      ? ok("twitter:card = summary_large_image")
      : bad(`twitter:card is ${meta["twitter:card"]}`);

    const img = meta["og:image"] ?? meta["twitter:image"];
    if (!img) {
      bad("no og:image on share page");
    } else {
      const res = await og.request.get(img);
      const body = res.ok() ? await res.body() : Buffer.alloc(0);
      const size = imageSize(body);
      size && body.length > 10000
        ? ok(`og:image is a real ${size.type.toUpperCase()} (${(body.length / 1024).toFixed(0)} KB)`)
        : bad(`og:image broken: ${res.status()} ${body.length}b ${img}`);
      // OG images must be 1200×675 so X renders a wide card, never a crop.
      if (size) {
        size.w === 1200 && size.h === 675
          ? ok(`og:image is ${size.w}×${size.h} (wide card)`)
          : bad(`og:image is ${size.w}×${size.h}, expected 1200×675`);
        await writeFile(path.join(OUT, `og-${label}.${size.type === "png" ? "png" : "jpg"}`), body);
      }
    }
    ok(`og:title: ${meta["og:title"]}`);
    await og.close();
  }

  await shareFlow("card");

  // Format A: the share image is a purpose-built 16:9 composition, not the pfp.
  await page.getByRole("button", { name: /PFP Frame/ }).click();
  await page.waitForFunction(() => document.querySelector("canvas")?.width === 1024);
  await page.waitForTimeout(200);
  await saveCanvas(page, "canvas", "pfp-final.png");
  await shareFlow("pfp");

  await page.screenshot({ path: path.join(OUT, "desktop.png"), fullPage: true });
  await ctx.close();

  /* --------------------------------------------------------------- mobile */
  console.log("\n[mobile: iPhone 15]");
  const mctx = await browser.newContext({ ...devices["iPhone 15"] });
  const mpage = await mctx.newPage();
  mpage.on("pageerror", (e) => errors.push("mobile: " + String(e)));
  await mpage.goto(BASE, { waitUntil: "networkidle" });
  await mpage.setInputFiles('input[type="file"]', path.join(FIX, "iphone.heic"));
  await mpage.waitForFunction(() => document.querySelector("canvas")?.width === 1024, { timeout: 15000 });
  ok("HEIC renders on mobile viewport");

  const overflow = await mpage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  overflow <= 1 ? ok("no horizontal overflow") : bad(`page overflows by ${overflow}px`);
  await mpage.screenshot({ path: path.join(OUT, "mobile.png"), fullPage: true });
  await mctx.close();

  await browser.close();

  const real = errors.filter((e) => !/DevTools|HMR|favicon/i.test(e));
  if (real.length) {
    console.log("\nconsole/page errors:");
    real.forEach((e) => console.log("  ! " + e.slice(0, 200)));
    fail.push(`${real.length} console errors`);
  }

  console.log(
    fail.length ? `\nFAILED (${fail.length}):\n${fail.map((f) => " - " + f).join("\n")}` : "\nALL CHECKS PASSED",
  );
  console.log(`artifacts → ${OUT}`);
  process.exit(fail.length ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
