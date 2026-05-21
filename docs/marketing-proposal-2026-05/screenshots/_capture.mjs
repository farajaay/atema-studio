// Screenshot capture for the marketing proposal audit.
// Hits live https://atemastudio.xyz at two viewports (mobile-first + desktop)
// across the public surfaces. Output lands in this folder alongside the proposal.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
await mkdir(HERE, { recursive: true });

const BASE = process.env.AUDIT_BASE || 'http://localhost:4173';

const PAGES = [
  { name: 'home',      path: '/#/' },
  { name: 'book',      path: '/#/book' },
  { name: 'portfolio', path: '/#/portfolio' },
  { name: 'journal',   path: '/#/journal' },
  { name: 'about',     path: '/#/about' },
];

const VIEWPORTS = [
  { name: 'mobile',  width: 390,  height: 844  },  // iPhone 14 Pro-ish
  { name: 'desktop', width: 1440, height: 900 },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      locale: 'ar-SA',
      ignoreHTTPSErrors: true,
      userAgent: vp.name === 'mobile'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    const page = await ctx.newPage();
    for (const p of PAGES) {
      const url = `${BASE}${p.path}`;
      console.log(`[${vp.name}] ${url}`);
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      } catch (e) {
        console.warn(`  navigation warning: ${e.message}`);
      }
      // Dismiss any promo modal that auto-opens on home.
      try { await page.keyboard.press('Escape'); } catch {}
      await page.waitForTimeout(1500);

      // Force every FadeUp section into its visible state so the snapshot
      // doesn't miss content that's gated on IntersectionObserver — a real
      // problem worth calling out, but not what we want in the audit shots.
      await page.evaluate(() => {
        document.querySelectorAll('*').forEach(el => {
          const cs = getComputedStyle(el);
          if (cs.opacity === '0' && cs.transition.includes('opacity')) {
            el.style.opacity = '1';
            el.style.transform = 'none';
          }
        });
      });

      // Slow-scroll to fire any remaining lazy hooks, then return to top.
      await page.evaluate(async () => {
        const step = 600;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(800);

      const out = `${HERE}/${vp.name}-${p.name}.png`;
      await page.screenshot({ path: out, fullPage: true });
      console.log(`  → ${out}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
