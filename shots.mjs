import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5179';
const OUT = 'shots';
mkdirSync(OUT, { recursive: true });

// Screens. `seed` = inject sample reports into localStorage so the
// dashboard / health-map render their POPULATED state (initialReports is
// empty by default). Sample reports are imported from the Vite-served
// module so the biomarker shapes always match the live schema.
const SCREENS = [
  { name: 'landing-full', path: '/' },
  { name: 'landing-minimal', path: '/minimal' },
  { name: 'quiz', path: '/quiz' },
  { name: 'tests', path: '/tests' },
  { name: 'dashboard-empty', path: '/dashboard' },
  { name: 'dashboard-populated', path: '/dashboard', seed: true },
  { name: 'healthmap-empty', path: '/health-map' },
  { name: 'healthmap-populated', path: '/health-map', seed: true },
  { name: 'upload', path: '/upload' },
  { name: 'manual-entry', path: '/manual-entry' },
  { name: 'profile', path: '/profile' },
  { name: 'results', path: '/reports/rep-001' },
  { name: 'problem', path: '/topics/low-testosterone' },
];

const VIEWPORTS = [
  { tag: 'desktop', opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { tag: 'mobile', opts: { ...devices['iPhone 13'] } },
];

async function seedReports(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const mod = await import('/src/app/data/reports.ts');
    const reports = mod.sampleReports;
    localStorage.setItem(
      'dc_reports',
      JSON.stringify({ savedAt: '2026-04-12T00:00:00.000Z', reports }),
    );
  });
}

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  for (const s of SCREENS) {
    const ctx = await browser.newContext(vp.opts);
    const page = await ctx.newPage();
    try {
      if (s.seed) await seedReports(page);
      await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle' });
      // Let entrance animations settle.
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: `${OUT}/${s.name}__${vp.tag}.png`,
        fullPage: true,
      });
      console.log(`OK  ${s.name} ${vp.tag}`);
    } catch (e) {
      console.log(`ERR ${s.name} ${vp.tag}: ${e.message}`);
    } finally {
      await ctx.close();
    }
  }
}
await browser.close();
console.log('DONE');
