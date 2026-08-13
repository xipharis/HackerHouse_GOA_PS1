/**
 * Verifies the two share paths.
 *
 *  1. Where the Web Share API supports files, "Share to X" must hand X the
 *     actual image file (a real attachment).
 *  2. Everywhere else it must fall back to the intent with the caption intact.
 */
import { chromium } from "playwright";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
let failed = 0;
const check = (l, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${l}${extra ? " — " + extra : ""}`);
};

const b = await chromium.launch();

/* ---- 1. touch device: the attach button must hand over a real file ------ */
console.log("\n[touch device: POST WITH IMAGE ATTACHED]");
const ctx = await b.newContext({ hasTouch: true, isMobile: true, viewport: { width: 420, height: 900 } });
// Stand in for a mobile share sheet and record what it was handed.
await ctx.addInitScript(() => {
  window.__shared = null;
  navigator.canShare = (d) => !!d?.files?.length;
  navigator.share = async (d) => {
    window.__shared = {
      text: d.text,
      files: (d.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })),
    };
  };
});
const p = await ctx.newPage();
await p.goto(BASE + "/pass", { waitUntil: "networkidle" });
await p.setInputFiles('input[type="file"]', path.join(process.cwd(), ".fixtures", "person.jpg"));
await p.waitForFunction(() => document.querySelector("canvas")?.width === 1200, { timeout: 20000 });
await p.getByRole("textbox").nth(0).fill("Aparna Krishnamurthy");
await p.getByRole("textbox").nth(1).fill("Rust · distributed systems");
// The share image is pre-built on a timer so the click keeps its activation.
await p.waitForTimeout(1500);
await p.getByRole("button", { name: "POST WITH IMAGE ATTACHED" }).click();
await p.waitForTimeout(1200);

const shared = await p.evaluate(() => window.__shared);
check("navigator.share was called", !!shared);
check("an actual image file was attached", (shared?.files?.length ?? 0) === 1,
      shared ? `${shared.files[0]?.type} ${(shared.files[0]?.size / 1024).toFixed(0)}KB` : "none");
check("attachment is a real JPEG payload", (shared?.files?.[0]?.size ?? 0) > 20000);
check("caption travelled with the image", /Hacker House Goa 2026/.test(shared?.text ?? ""));
check("caption has the name line", /My name - Aparna/.test(shared?.text ?? ""));
check("caption has both hashtags", /#FrameInGoa #HHGoa2026/.test(shared?.text ?? ""));
check("no popup was opened", p.context().pages().length === 1);
await ctx.close();

/* ---- 2. Share to X must ALWAYS reach an X composer, on every platform --- */
console.log("\n[desktop: SHARE TO X always opens the X intent]");
const ctx2 = await b.newContext();
await ctx2.addInitScript(() => {
  // A desktop OS share sheet exists but has no X entry — the old bug. Share to
  // X must ignore it entirely and go straight to the intent.
  window.__sharedDesktop = false;
  navigator.canShare = () => true;
  navigator.share = async () => {
    window.__sharedDesktop = true;
  };
});
let intent = null;
await ctx2.route(/x\.com/, (r) => {
  intent ??= r.request().url();
  r.fulfill({ contentType: "text/html", body: "ok" });
});
const p2 = await ctx2.newPage();
await p2.goto(BASE + "/pfp", { waitUntil: "networkidle" });
await p2.setInputFiles('input[type="file"]', path.join(process.cwd(), ".fixtures", "person.jpg"));
await p2.waitForFunction(() => document.querySelector("canvas")?.width === 1024, { timeout: 20000 });
const pop = p2.waitForEvent("popup", { timeout: 20000 });
await p2.getByRole("button", { name: "SHARE TO X" }).click();
try {
  const w = await pop;
  await w.waitForURL(/x\.com/, { timeout: 20000 });
  const text = new URL(intent ?? w.url()).searchParams.get("text") ?? "";
  check("opens the X intent", /\/intent\/(post|tweet)/.test(new URL(intent).pathname));
  check("did NOT hijack to the OS share sheet",
        (await p2.evaluate(() => window.__sharedDesktop)) === false);
  // This page is /pfp, which has its own opening line; the signal line is the
  // part both formats share.
  check("pfp caption survives the fallback",
        /New PFP, Hacker House Goa 2026 energy/.test(text));
  check("signal line survives the fallback", /😼 Less noise\. More signal\./.test(text));
  check("link is in the body, not appended after the hashtags",
        text.trimEnd().endsWith("#FrameInGoa #HHGoa2026"));
} catch (e) {
  check("opens the X intent", false, e.message.split("\n")[0]);
}
await ctx2.close();

await b.close();
console.log(failed ? `\n  FAILED (${failed})` : "\n  all share checks passed");
process.exit(failed ? 1 : 0);
