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

/**
 * Conta quantos slides existem no HTML.
 * Um slide é identificado por <section class="creative-slide"> (atributos adicionais permitidos).
 * Retorna 0 se não houver nenhum slide marcado (modo single).
 */
export function countSlides(html: string): number {
  const regex =
    /<section\s[^>]*class\s*=\s*["'][^"']*creative-slide[^"']*["'][^>]*>/gi;
  const matches = html.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Renderiza o HTML e retorna um Buffer por slide.
 * Se não houver slides marcados (countSlides == 0), retorna array com 1 buffer (modo single).
 * O viewport é expandido verticalmente para acomodar N slides de 1350px cada.
 */
export async function renderHtmlToPngs(html: string): Promise<Buffer[]> {
  const slideCount = countSlides(html);
  const n = Math.max(1, slideCount); // 0 slides = single mode (usa 1 screenshot)

  await acquireSlot();
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      const viewportHeight = n > 1 ? n * 1350 : 1350;
      await page.setViewport({
        width: 1080,
        height: viewportHeight,
        deviceScaleFactor: 2,
      });
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
      await page.evaluateHandle("document.fonts.ready");

      const buffers: Buffer[] = [];

      if (n <= 1) {
        // Single slide — clip 1080×1350 no topo
        const shot = await page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: 1080, height: 1350 },
        });
        buffers.push(Buffer.from(shot as unknown as Uint8Array));
      } else {
        // Múltiplos slides — clip N vezes verticalmente
        for (let i = 0; i < n; i++) {
          const shot = await page.screenshot({
            type: "png",
            clip: { x: 0, y: i * 1350, width: 1080, height: 1350 },
          });
          buffers.push(Buffer.from(shot as unknown as Uint8Array));
        }
      }

      renderCount++;
      return buffers;
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    releaseSlot();
  }
}

/**
 * Wrapper de compatibilidade — retorna apenas o primeiro slide como Buffer.
 * Comportamento idêntico ao original para todos os consumidores existentes.
 */
export async function renderHtmlToPng(html: string): Promise<Buffer> {
  const buffers = await renderHtmlToPngs(html);
  return buffers[0];
}
