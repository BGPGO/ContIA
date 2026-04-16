import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = 'https://www.instagram.com/p/DWOiE1gAMl6/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Block login popups
  await page.route('**/accounts/login/**', route => route.abort());

  console.log('Navigating to post...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Dismiss any popups/modals
  try {
    const closeBtn = page.locator('svg[aria-label="Close"]').first();
    if (await closeBtn.isVisible({ timeout: 2000 })) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  } catch {}

  try {
    const notNow = page.getByText('Not Now', { exact: false }).first();
    if (await notNow.isVisible({ timeout: 1000 })) {
      await notNow.click();
      await page.waitForTimeout(500);
    }
  } catch {}

  // Take full page screenshot first
  await page.screenshot({ path: join(__dirname, 'slide-full.png'), fullPage: false });
  console.log('Saved slide-full.png');

  // Now try to capture each slide
  for (let i = 0; i < 7; i++) {
    // Find the main carousel image area and screenshot it
    try {
      // Try to find the image container
      const img = page.locator('article img[style*="object-fit"]').first();
      if (await img.isVisible({ timeout: 2000 })) {
        await img.screenshot({ path: join(__dirname, `slide-${i + 1}.png`) });
        console.log(`Saved slide-${i + 1}.png (from img)`);
      } else {
        // Fallback: screenshot the article area
        const article = page.locator('article').first();
        await article.screenshot({ path: join(__dirname, `slide-${i + 1}.png`) });
        console.log(`Saved slide-${i + 1}.png (from article)`);
      }
    } catch (e) {
      console.log(`Slide ${i + 1}: fallback full screenshot`, e.message);
      await page.screenshot({ path: join(__dirname, `slide-${i + 1}.png`), fullPage: false });
    }

    // Click next button
    if (i < 6) {
      try {
        const nextBtn = page.locator('button[aria-label="Next"]').first();
        if (await nextBtn.isVisible({ timeout: 2000 })) {
          await nextBtn.click();
          await page.waitForTimeout(1500);
        } else {
          // Try SVG chevron approach
          const chevron = page.locator('div[role="presentation"] button').last();
          await chevron.click();
          await page.waitForTimeout(1500);
        }
      } catch (e) {
        console.log(`Could not navigate to slide ${i + 2}:`, e.message);
      }
    }
  }

  await browser.close();
  console.log('Done!');
})();
