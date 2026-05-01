// api/cimb-rate.js  — Vercel serverless function
// Runs on the SERVER (Node.js), not the browser — can load JS-rendered pages
// Deploy: add this file to your repo at api/cimb-rate.js
// Vercel auto-detects it as a serverless function at /api/cimb-rate

const chromium = require(”@sparticuz/chromium”);
const puppeteer = require(“puppeteer-core”);

module.exports = async (req, res) => {
// CORS — allow your Vercel frontend to call this
res.setHeader(“Access-Control-Allow-Origin”, “*”);
res.setHeader(“Access-Control-Allow-Methods”, “GET”);

let browser = null;
try {
browser = await puppeteer.launch({
args: chromium.args,
defaultViewport: chromium.defaultViewport,
executablePath: await chromium.executablePath(),
headless: chromium.headless,
});

```
const page = await browser.newPage();

// Block images/fonts to load faster
await page.setRequestInterception(true);
page.on("request", (req) => {
  if (["image", "font", "stylesheet"].includes(req.resourceType())) {
    req.abort();
  } else {
    req.continue();
  }
});

await page.goto("https://www.cimbclicks.com.sg/sgd-to-myr", {
  waitUntil: "networkidle2",
  timeout: 20000,
});

// Wait for the rate element — CIMB renders a number like "3.1050"
// The page replaces {myCurrency} placeholder with the actual rate
await page.waitForFunction(
  () => {
    const body = document.body.innerText;
    return /3\.\d{4}/.test(body); // SGD/MYR is always 3.something
  },
  { timeout: 15000 }
);

const bodyText = await page.evaluate(() => document.body.innerText);

// Extract rate — looks for a number like 3.1050
const match = bodyText.match(/\b(3\.\d{3,5})\b/);
if (!match) throw new Error("Rate not found in page text");

const rate = parseFloat(match[1]);
const fetchedAt = new Date().toISOString();

await browser.close();

res.status(200).json({
  success: true,
  rate,
  pair: "SGD-MYR",
  source: "CIMB Clicks",
  fetchedAt,
});
```

} catch (err) {
if (browser) await browser.close().catch(() => {});
res.status(500).json({
success: false,
error: err.message,
});
}
};
