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

const THEME = process.env.THEME === 'light' ? 'light' : 'dark';
// Light spot-check set (desktop only) — the palette-sensitive screens.
const LIGHT_ONLY = new Set([
  'landing-full', 'dashboard-populated', 'healthmap-populated', 'results', 'profile',
]);

async function primeStorage(page, { seed }) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    async ({ theme, seed }) => {
      if (theme === 'light') localStorage.setItem('dc_theme', 'light');
      if (seed) {
        const mod = await import('/src/app/data/reports.ts');
        localStorage.setItem(
          'dc_reports',
          JSON.stringify({ savedAt: '2026-04-12T00:00:00.000Z', reports: mod.sampleReports }),
        );
      }
    },
    { theme: THEME, seed: !!seed },
  );
}

// Scroll top→bottom in viewport steps to trip every whileInView Reveal,
// then return to top. Without this, full-page shots capture below-fold
// sections frozen at opacity:0.
async function triggerReveals(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    const end = document.body.scrollHeight;
    for (let y = 0; y < end; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 200));
  });
}

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  for (const s of SCREENS) {
    if (THEME === 'light' && (vp.tag === 'mobile' || !LIGHT_ONLY.has(s.name))) continue;
    const ctx = await browser.newContext(vp.opts);
    const page = await ctx.newPage();
    try {
      await primeStorage(page, s);
      await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await triggerReveals(page);
      await page.screenshot({
        path: `${OUT}/${s.name}__${vp.tag}__${THEME}.png`,
        fullPage: true,
      });
      console.log(`OK  ${s.name} ${vp.tag} ${THEME}`);
    } catch (e) {
      console.log(`ERR ${s.name} ${vp.tag} ${THEME}: ${e.message}`);
    } finally {
      await ctx.close();
    }
  }
}
await browser.close();
console.log('DONE');
