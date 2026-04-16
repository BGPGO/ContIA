import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = 'https://www.instagram.com/p/DWOiE1gAMl6/?img_index=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('Navigating to post...');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Dismiss popups by pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Screenshot each slide by navigating via URL img_index
  for (let i = 1; i <= 7; i++) {
    const slideUrl = `https://www.instagram.com/p/DWOiE1gAMl6/?img_index=${i}`;
    console.log(`Loading slide ${i}...`);
    await page.goto(slideUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Dismiss any popups
    try { await page.keyboard.press('Escape'); } catch {}
    await page.waitForTimeout(500);

    await page.screenshot({
      path: join(__dirname, `slide-${i}.png`),
      fullPage: false
    });
    console.log(`Saved slide-${i}.png`);
  }

  await browser.close();
  console.log('Done!');
})();
