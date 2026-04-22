import type { Browser } from "puppeteer";

let browserPromise: Promise<Browser> | null = null;
let renderCount = 0;
let activeRenders = 0;
const queue: Array<() => void> = [];
const MAX_CONCURRENT = 2;
const RECYCLE_AFTER = 50;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise;
    if (b.connected && renderCount < RECYCLE_AFTER) return b;
    try {
      await b.close();
    } catch {
      // ignora erros ao fechar browser morto
    }
    browserPromise = null;
  }
  if (!browserPromise) {
    const puppeteer = (await import("puppeteer")).default;
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    });
    renderCount = 0;
  }
  return browserPromise;
}

async function acquireSlot(): Promise<void> {
  if (activeRenders < MAX_CONCURRENT) {
    activeRenders++;
    return;
  }
  await new Promise<void>((resolve) => queue.push(resolve));
  activeRenders++;
}

function releaseSlot(): void {
  activeRenders--;
  const next = queue.shift();
  if (next) next();
}

export async function renderHtmlToPng(html: string): Promise<Buffer> {
  await acquireSlot();
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({
        width: 1080,
        height: 1350,
        deviceScaleFactor: 2,
      });
      await page.setContent(html, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });
      await page.evaluateHandle("document.fonts.ready");
      // Puppeteer 24.x retorna Uint8Array; convertemos para Buffer para compatibilidade
      const result = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: 1080, height: 1350 },
      });
      renderCount++;
      return Buffer.from(result as Uint8Array);
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    releaseSlot();
  }
}
