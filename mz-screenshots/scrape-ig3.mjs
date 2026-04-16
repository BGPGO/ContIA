import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Block signup/login modals via CSS injection
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = `
      div[role="dialog"], div[role="presentation"] > div[style*="z-index"] { display: none !important; }
      body > div[class*="RnEpo"] { display: none !important; }
    `;
    document.head.appendChild(style);
  });

  for (let i = 1; i <= 7; i++) {
    const slideUrl = `https://www.instagram.com/p/DWOiE1gAMl6/?img_index=${i}`;
    console.log(`Loading slide ${i}...`);
    await page.goto(slideUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Force-remove all dialogs/modals
    await page.evaluate(() => {
      // Remove modal overlays
      document.querySelectorAll('div[role="dialog"]').forEach(el => el.remove());
      document.querySelectorAll('div[role="presentation"]').forEach(el => {
        if (el.querySelector('button') && el.textContent.includes('Sign up')) {
          el.remove();
        }
      });
      // Remove any fixed overlays
      document.querySelectorAll('div[style*="position: fixed"]').forEach(el => {
        if (el.textContent.includes('miss') || el.textContent.includes('Sign') || el.textContent.includes('Log')) {
          el.remove();
        }
      });
    });
    await page.waitForTimeout(500);

    // Try to find and screenshot just the image
    try {
      // Get all img elements and find the carousel one (largest visible image)
      const imgSrc = await page.evaluate((idx) => {
        const imgs = Array.from(document.querySelectorAll('img'));
        // Find images that look like post content (large, square-ish)
        const postImgs = imgs.filter(img => {
          const rect = img.getBoundingClientRect();
          return rect.width > 300 && rect.height > 300 && img.src.includes('instagram');
        });
        // Return the src of the best match
        if (postImgs.length > 0) {
          return { src: postImgs[0].src, found: true };
        }
        return { src: '', found: false };
      }, i);

      if (imgSrc.found) {
        console.log(`  Image found: ${imgSrc.src.slice(0, 80)}...`);
      }
    } catch {}

    await page.screenshot({
      path: join(__dirname, `slide-${i}.png`),
      fullPage: false
    });
    console.log(`Saved slide-${i}.png`);
  }

  await browser.close();
  console.log('Done!');
})();
