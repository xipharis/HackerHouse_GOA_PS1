import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = ".e2e-out"; await mkdir(OUT, { recursive: true });
const b = await chromium.launch();

const errs = [];
const desk = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const p = await desk.newPage();
p.on("pageerror", e => errs.push("landing: " + e.message));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForTimeout(600);
await p.screenshot({ path: path.join(OUT, "landing.png"), fullPage: true });

async function shoot(route, file, fill) {
  const pg = await desk.newPage();
  pg.on("pageerror", e => errs.push(route + ": " + e.message));
  await pg.goto(BASE + route, { waitUntil: "networkidle" });
  await pg.setInputFiles('input[type="file"]', path.join(process.cwd(), ".fixtures", "person.jpg"));
  await pg.waitForFunction(() => {
    const c = document.querySelector("canvas");
    return c && c.width > 300 && !c.className.includes("invisible");
  }, { timeout: 20000 });
  if (fill) { await fill(pg); await pg.waitForTimeout(400); }
  await pg.screenshot({ path: path.join(OUT, file + "-page.png"), fullPage: true });
  const url = await pg.evaluate(() => document.querySelector("canvas").toDataURL("image/png"));
  await writeFile(path.join(OUT, file + ".png"), Buffer.from(url.split(",")[1], "base64"));
  await pg.close();
}

await shoot("/pfp", "art-pfp");
await shoot("/pass", "art-pass", async (pg) => {
  const t = pg.getByRole("textbox");
  await t.nth(0).fill("Aparna Krishnamurthy");
  await t.nth(1).fill("Rust · distributed systems");
  await t.nth(2).fill("Bengaluru, IN");
});

const m = await b.newContext({ ...(await import("playwright")).devices["iPhone 15"] });
const mp = await m.newPage();
await mp.goto(BASE, { waitUntil: "networkidle" });
await mp.waitForTimeout(500);
await mp.screenshot({ path: path.join(OUT, "landing-mobile.png"), fullPage: true });
const ov = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log("mobile overflow:", ov + "px");
await b.close();
console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "no page errors");
