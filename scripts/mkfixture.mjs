import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
// A stand-in "portrait": subject high and off to the left, like a real phone snap.
const dataUrl = await p.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1620;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0,0,0,1620);
  g.addColorStop(0,"#7dd3fc"); g.addColorStop(1,"#065f46");
  x.fillStyle = g; x.fillRect(0,0,1080,1620);
  x.fillStyle = "#0f172a"; x.fillRect(0,1180,1080,440);          // ground
  x.fillStyle = "#fbbf24";                                        // head
  x.beginPath(); x.arc(390, 520, 210, 0, Math.PI*2); x.fill();
  x.fillStyle = "#f97316";                                        // shoulders
  x.beginPath(); x.ellipse(390, 1150, 340, 420, 0, 0, Math.PI*2); x.fill();
  x.fillStyle = "#0f172a"; x.font = "bold 90px sans-serif";
  x.fillText("SUBJECT", 120, 1520);
  return c.toDataURL("image/jpeg", 0.92);
});
const fs = await import("node:fs/promises");
await fs.writeFile("/Users/phantomxsd/Desktop/REPOS/HHGoa/.fixtures/person.jpg",
  Buffer.from(dataUrl.split(",")[1], "base64"));
await b.close();
console.log("wrote person.jpg");
