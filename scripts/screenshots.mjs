/**
 * Captures README screenshots of a running CHRONO.EXE instance.
 *
 *   node scripts/screenshots.mjs [baseUrl] [outDir]
 *
 * Uses your installed Chrome through puppeteer-core (set CHROME_PATH to override).
 * Run it against an instance filled with demo data (npm run db:demo).
 */
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "docs/screenshots";
const candidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome"
].filter(Boolean);
const executablePath = candidates.find((path) => existsSync(path));
if (!executablePath) throw new Error("Chrome not found: set CHROME_PATH");

const shots = [
  // Tall viewports instead of fullPage: the sidebar and status bar are fixed.
  { name: "today", path: "/", height: 860 },
  { name: "history-week", path: `/history?view=week&date=${process.env.WEEK_DATE ?? ""}`, height: 1180 },
  { name: "history-month", path: "/history?view=month", height: 1000 },
  { name: "settings-categories", path: "/settings", height: 900 }
];

mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 } });
try {
  const page = await browser.newPage();
  for (const shot of shots) {
    await page.setViewport({ width: 1440, height: shot.height, deviceScaleFactor: 1 });
    await page.goto(`${base}${shot.path}`, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => undefined);
    // Let fonts load and live data arrive.
    await new Promise((resolve) => setTimeout(resolve, 3500));
    await page.screenshot({ path: `${out}/${shot.name}.png` });
    console.log(`saved ${out}/${shot.name}.png`);
  }
  if (process.env.POPUP_URL) {
    await page.setViewport({ width: 300, height: 470, deviceScaleFactor: 2 });
    await page.goto(process.env.POPUP_URL, { waitUntil: "networkidle2" });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await page.screenshot({ path: `${out}/extension-popup.png` });
    console.log(`saved ${out}/extension-popup.png`);
  }
} finally {
  await browser.close();
}
