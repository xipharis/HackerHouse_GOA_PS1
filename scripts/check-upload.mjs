/**
 * Does clicking the visible upload affordances actually open a file picker?
 *
 * This exists because the main e2e suite calls setInputFiles() straight on the
 * <input>, which bypasses the click path entirely — the exact path that broke.
 *
 *   node scripts/check-upload.mjs [baseUrl] [chromium|webkit|firefox]
 */

import { chromium, webkit, firefox } from "playwright";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const name = process.argv[3] ?? "chromium";
const engine = { chromium, webkit, firefox }[name];

console.log(`\n=== ${name} ===`);
const b = await engine.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errs.push("console: " + m.text()));
await page.goto(BASE, { waitUntil: "networkidle" });

let failed = 0;
const check = (label, pass, extra = "") => {
  if (!pass) failed++;
  console.log(`  ${pass ? "✓" : "✗"} ${label}${extra ? " — " + extra : ""}`);
};

/**
 * Presses a real mouse button at the centre of the target's box, which is what
 * a user does. Driving a click at a text node that the transparent input covers
 * is not the same thing and reports false negatives.
 */
async function opensPicker(locator) {
  const box = await locator.boundingBox();
  if (!box) return false;
  try {
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 4000 }),
      page.mouse.click(box.x + box.width / 2, box.y + box.height / 2),
    ]);
    await chooser.setFiles([]);
    return true;
  } catch {
    return false;
  }
}

const dropZone = () => page.locator("input[type=file]").nth(0);
const chooseBtn = () => page.locator("input[type=file]").last();

check("drop zone opens the picker", await opensPicker(dropZone()));
check("'Choose photo' opens the picker", await opensPicker(chooseBtn()));

/* The full path: click, pick a real file, expect finished artwork. */
async function pick(locator, file) {
  const box = await locator.boundingBox();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 4000 }),
    page.mouse.click(box.x + box.width / 2, box.y + box.height / 2),
  ]);
  await chooser.setFiles(path.join(process.cwd(), ".fixtures", file));
}

try {
  await pick(dropZone(), "person.jpg");
  // 1024² for the pfp route, 1080×1350 for the pass route — either counts.
  await page.waitForFunction(
    () => {
      const c = document.querySelector("canvas");
      return !!c && c.width >= 1024 && !c.className.includes("invisible");
    },
    { timeout: 20000 },
  );
  check("click → pick → renders", true);
} catch (e) {
  check("click → pick → renders", false, e.message.split("\n")[0]);
}

/* Re-picking the SAME file must still re-render (input.value must be reset). */
try {
  await pick(chooseBtn(), "person.jpg");
  await page.waitForTimeout(1200);
  check(
    "same file can be re-picked",
    await page.evaluate(() => (document.querySelector("canvas")?.width ?? 0) >= 1024),
  );
} catch (e) {
  check("same file can be re-picked", false, e.message.split("\n")[0]);
}

/* Upload must not depend on hydration: with JS off the native input still works.
   That's the failure mode where the page looks fine but every handler is dead. */
const noJs = await b.newContext({ javaScriptEnabled: false });
const p2 = await noJs.newPage();
await p2.goto(BASE);
try {
  const box = await p2.locator("input[type=file]").nth(0).boundingBox();
  const [c] = await Promise.all([
    p2.waitForEvent("filechooser", { timeout: 4000 }),
    p2.mouse.click(box.x + box.width / 2, box.y + box.height / 2),
  ]);
  await c.setFiles([]);
  check("works with JavaScript disabled", true);
} catch (e) {
  check("works with JavaScript disabled", false, e.message.split("\n")[0]);
}
await noJs.close();

if (errs.length) {
  failed++;
  console.log("  errors:\n   " + errs.join("\n   "));
}
console.log(failed ? `  FAILED (${failed})` : "  all upload checks passed");
await b.close();
process.exit(failed ? 1 : 0);
