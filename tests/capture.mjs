// Capture canonical screenshots for visual regression.
// Usage (from the dev-browser skill dir, which has playwright):
//   npx tsx /home/evan/dev/lonesome-dove-viz/tests/capture.mjs <outdir>
// Compares are done by tests/visual-check.sh.
import { mkdirSync } from "fs";
import { createRequire } from "module";
// resolve playwright from the dev-browser skill's node_modules
const require = createRequire(
  process.env.HOME + "/.claude/plugins/cache/dev-browser-marketplace/dev-browser/66682fb0513a/skills/dev-browser/package.json");
const { chromium } = require("playwright");

const out = process.argv[2] || "/tmp/ld-shots";
mkdirSync(out, { recursive: true });
const URL = "https://omachine.werewolf-universe.ts.net/lonesome-dove/";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true, reducedMotion: "reduce" });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("ld-seen", "1")); // no first-visit toast in goldens
const errors = [];
page.on("pageerror", e => errors.push(e.message));

const settle = async () => { await page.waitForTimeout(2600); };

await page.goto(URL);
await page.waitForLoadState("load");
await settle();
await page.screenshot({ path: `${out}/map-fit.png` });

await page.evaluate(() => { location.hash = "#event/gus-death"; });
await settle();
await page.screenshot({ path: `${out}/event-card.png` });

await page.evaluate(() => { location.hash = "#journeys"; });
await settle();
await page.screenshot({ path: `${out}/journeys-fit.png` });

// mid-scrub: trails truncated at a fixed time, rider dots at their August 1876 positions
await page.evaluate(() => {
  const s = document.getElementById("scrub");
  s.value = 320; s.dispatchEvent(new Event("input"));
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/journeys-mid.png` });

// phone goldens: portrait map + bottom-sheet card
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true, reducedMotion: "reduce" });
const mp = await mctx.newPage();
await mp.addInitScript(() => localStorage.setItem("ld-seen", "1"));
mp.on("pageerror", e => errors.push(e.message));
await mp.goto(URL);
await mp.waitForLoadState("load");
await mp.waitForTimeout(2600);
await mp.screenshot({ path: `${out}/mobile-map.png` });
await mp.evaluate(() => { location.hash = "#event/jake-hanged"; });
await mp.waitForTimeout(2600);
await mp.screenshot({ path: `${out}/mobile-sheet.png` });

console.log(JSON.stringify({ errors: errors.length, out }));
await browser.close();
