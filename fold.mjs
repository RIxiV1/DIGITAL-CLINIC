import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5179';
const OUT = 'shots';
mkdirSync(OUT, { recursive: true });

// Fixed-bar / touch-target screens — viewport (fold) shots, NOT fullPage,
// so position:fixed bars (quiz StickyBottomBar, mobile BottomNav) render at
// their true on-screen location instead of the fullPage artifact spot.
const SCREENS = [
  { name: 'quiz', path: '/quiz', seed: false },
  { name: 'dashboard-populated', path: '/dashboard', seed: true },
  { name: 'healthmap-populated', path: '/health-map', seed: true },
  { name: 'manual-entry', path: '/manual-entry', seed: false },
];

async function prime(page, seed) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  if (seed) {
    await page.evaluate(async () => {
      const mod = await import('/src/app/data/reports.ts');
      localStorage.setItem('dc_reports', JSON.stringify({ savedAt: '2026-04-12T00:00:00.000Z', reports: mod.sampleReports }));
    });
  }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
for (const s of SCREENS) {
  const page = await ctx.newPage();
  try {
    await prime(page, s.seed);
    await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/${s.name}__mobile__fold.png`, fullPage: false });
    console.log(`OK ${s.name}`);
  } catch (e) { console.log(`ERR ${s.name}: ${e.message}`); }
  finally { await page.close(); }
}
await browser.close();
console.log('DONE');
