/**
 * Every caption the app can produce must fit a free X account's 280 characters.
 *
 * Counting mirrors X: any URL costs 23, non-Latin (emoji) costs 2. Implemented
 * independently of lib/tweet.ts on purpose — a bug copied into both would
 * otherwise pass.
 */
const URL_RE = /https?:\/\/\S+/gi;
const LIMIT = 280;

function weighted(text) {
  let t = 0;
  for (const ch of text.replace(URL_RE, "x".repeat(23))) {
    const cp = ch.codePointAt(0);
    t +=
      cp <= 0x10ff ||
      (cp >= 0x2000 && cp <= 0x200d) ||
      (cp >= 0x2010 && cp <= 0x201f) ||
      (cp >= 0x2032 && cp <= 0x2037)
        ? 1
        : 2;
  }
  return t;
}

const BASE = process.argv[2] ?? "http://localhost:3000";
const { chromium } = await import("playwright");
const path = await import("node:path");

let failed = 0;
const check = (label, n, extra = "") => {
  const ok = n <= LIMIT;
  if (!ok) failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(34)} ${String(n).padStart(3)}/${LIMIT}${extra}`);
};

const b = await chromium.launch();
const ctx = await b.newContext();
let intent = null;
await ctx.route(/x\.com/, (r) => {
  intent = r.request().url();
  r.fulfill({ contentType: "text/html", body: "ok" });
});

/** Fills the pass, shares, and returns the caption X would receive. */
async function captionFor(route, fields = []) {
  intent = null;
  const p = await ctx.newPage();
  await p.goto(BASE + route, { waitUntil: "networkidle" });
  await p.setInputFiles('input[type="file"]', path.join(process.cwd(), ".fixtures", "person.jpg"));
  await p.waitForFunction(() => (document.querySelector("canvas")?.width ?? 0) >= 1024, {
    timeout: 20000,
  });
  for (const [i, v] of fields.entries()) await p.getByRole("textbox").nth(i).fill(v);
  if (fields.length) await p.waitForTimeout(300);

  const pop = p.waitForEvent("popup", { timeout: 25000 });
  await p.getByRole("button", { name: "SHARE TO X" }).click();
  const w = await pop;
  await w.waitForURL(/x\.com/, { timeout: 25000 });
  const text = new URL(intent ?? w.url()).searchParams.get("text") ?? "";
  await w.close();
  await p.close();
  return text;
}

const long = "W".repeat(40);

const pfp = await captionFor("/pfp");
check("pfp", weighted(pfp));

const typical = await captionFor("/pass", [
  "Aparna Krishnamurthy",
  "Rust · distributed systems",
  "Bengaluru, IN",
  "Team Feni",
]);
check("pass, typical fields", weighted(typical));

// name, stack, team, builder title — the caption carries name, stack and title.
const maxed = await captionFor("/pass", [long, long, "Mumbai, IN", long, long]);
check("pass, three 40-char fields", weighted(maxed));

// The hashtags and link must survive whatever trimming happened.
const keeps = (t, what, re) => {
  const ok = re.test(t);
  if (!ok) failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}`);
};
keeps(maxed, "hashtags survive trimming", /#FrameInGoa #HHGoa2026$/);
// The card is attached to the post, so the link is the "make your own" CTA.
keeps(maxed, "link survives trimming", /https?:\/\/\S+\/(pass|pfp)\b/i);
keeps(maxed, "name line survives trimming", /😎 My name - W/);

console.log("\n  --- maxed-out caption ---");
console.log(maxed.split("\n").map((l) => "  | " + l).join("\n"));

await b.close();
console.log(failed ? `\n  FAILED (${failed})` : "\n  all captions fit 280");
process.exit(failed ? 1 : 0);
