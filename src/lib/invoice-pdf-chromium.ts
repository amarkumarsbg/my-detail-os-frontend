import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

const PDF_CACHE_TTL_MS = 30 * 60 * 1000;
const PDF_CACHE_MAX = 64;
const BROWSER_IDLE_MS = 30 * 60 * 1000;

type PdfCacheEntry = { base64: string; expiresAt: number };
const pdfCache = new Map<string, PdfCacheEntry>();

type BrowserGlobals = {
  __invoicePdfBrowser?: Browser;
  __invoicePdfBrowserLaunch?: Promise<Browser>;
  __invoicePdfPage?: Page;
  __invoicePdfIdleTimer?: ReturnType<typeof setTimeout>;
  __invoicePdfRenderChain?: Promise<void>;
};

const g = globalThis as typeof globalThis & BrowserGlobals;

function cacheKeyFor(html: string, explicitKey?: string): string {
  if (explicitKey?.trim()) return explicitKey.trim();
  return createHash("sha256").update(html).digest("hex").slice(0, 24);
}

function readPdfCache(key: string): string | undefined {
  const hit = pdfCache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    pdfCache.delete(key);
    return undefined;
  }
  return hit.base64;
}

function writePdfCache(key: string, base64: string): void {
  if (pdfCache.size >= PDF_CACHE_MAX) {
    const first = pdfCache.keys().next().value;
    if (first) pdfCache.delete(first);
  }
  pdfCache.set(key, { base64, expiresAt: Date.now() + PDF_CACHE_TTL_MS });
}

function scheduleBrowserIdleClose(): void {
  if (g.__invoicePdfIdleTimer) clearTimeout(g.__invoicePdfIdleTimer);
  g.__invoicePdfIdleTimer = setTimeout(() => {
    void closeSharedBrowser();
  }, BROWSER_IDLE_MS);
}

async function closeSharedBrowser(): Promise<void> {
  const browser = g.__invoicePdfBrowser;
  const page = g.__invoicePdfPage;
  g.__invoicePdfBrowser = undefined;
  g.__invoicePdfPage = undefined;
  g.__invoicePdfBrowserLaunch = undefined;
  if (page && !page.isClosed()) {
    await page.close().catch(() => undefined);
  }
  if (browser?.isConnected()) {
    await browser.close().catch(() => undefined);
  }
}

/** Start Chrome early (call when opening an invoice). */
export async function warmPrintBrowser(): Promise<void> {
  await getSharedBrowser();
  scheduleBrowserIdleClose();
}

function enqueuePdfRender<T>(task: () => Promise<T>): Promise<T> {
  const run = (g.__invoicePdfRenderChain ?? Promise.resolve()).then(task);
  g.__invoicePdfRenderChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Same engine as browser Print → Save as PDF (vector text, crisp layout). */
export async function htmlToPrintQualityPdfBase64(
  html: string,
  cacheKey?: string
): Promise<string> {
  const key = cacheKeyFor(html, cacheKey);
  const cached = readPdfCache(key);
  if (cached) return cached;

  return enqueuePdfRender(async () => {
    const hit = readPdfCache(key);
    if (hit) return hit;

    const browser = await getSharedBrowser();
    const page = await getSharedPrintPage(browser);
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 12_000 });
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
    const base64 = Buffer.from(pdf).toString("base64");
    writePdfCache(key, base64);
    scheduleBrowserIdleClose();
    return base64;
  });
}

async function getSharedPrintPage(browser: Browser): Promise<Page> {
  const existing = g.__invoicePdfPage;
  if (existing && !existing.isClosed()) return existing;

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 1 });
  await page.emulateMediaType("print");
  g.__invoicePdfPage = page;
  return page;
}

async function getSharedBrowser(): Promise<Browser> {
  if (g.__invoicePdfBrowser?.isConnected()) {
    return g.__invoicePdfBrowser;
  }

  if (!g.__invoicePdfBrowserLaunch) {
    g.__invoicePdfBrowserLaunch = launchPrintBrowser()
      .then((browser) => {
        g.__invoicePdfBrowser = browser;
        g.__invoicePdfBrowserLaunch = undefined;
        browser.on("disconnected", () => {
          g.__invoicePdfBrowser = undefined;
          g.__invoicePdfPage = undefined;
        });
        return browser;
      })
      .catch((err) => {
        g.__invoicePdfBrowserLaunch = undefined;
        throw err;
      });
  }

  return g.__invoicePdfBrowserLaunch;
}

function isServerlessHost(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_VERSION ||
      process.env.RENDER
  );
}

function localBrowserExecutable(): string | undefined {
  if (process.env.CHROME_PATH?.trim()) return process.env.CHROME_PATH.trim();

  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
          ];

  return candidates.find((p) => existsSync(p));
}

/**
 * `@sparticuz/chromium-min` does not ship the Chrome binary — it downloads a
 * version-matched pack at runtime. Calling `executablePath()` with no URL looks
 * for a local `bin/` folder and fails on Vercel with:
 * "The input directory .../@sparticuz/chromium-min/bin does not exist."
 */
function serverlessChromiumPackUrl(): string {
  const fromEnv = process.env.CHROMIUM_PACK_URL?.trim();
  if (fromEnv) return fromEnv;
  // Keep in sync with package.json `@sparticuz/chromium-min` version.
  return "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar";
}

async function launchPrintBrowser(): Promise<Browser> {
  if (isServerlessHost()) {
    const chromium = await import("@sparticuz/chromium-min");
    chromium.default.setGraphicsMode = false;
    const executablePath = await chromium.default.executablePath(
      serverlessChromiumPackUrl()
    );
    return puppeteer.launch({
      args: chromium.default.args,
      defaultViewport:
        chromium.default.defaultViewport ?? {
          width: 800,
          height: 1200,
          deviceScaleFactor: 1,
        },
      executablePath,
      headless: chromium.default.headless ?? true,
    });
  }

  const executablePath = localBrowserExecutable();
  if (!executablePath) {
    throw new Error(
      "Chrome or Edge not found for invoice PDF. Install Chrome or set CHROME_PATH to your browser executable."
    );
  }

  return puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--no-first-run",
    ],
  });
}
