import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile layout regression tests based on docs/MOBILE.md.
 * Checks for horizontal scroll overflow which is a common layout regression
 * on mobile screens when `min-w-0` is missed.
 */

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'dc_quiz',
      JSON.stringify({
        age: '35-44',
        activity: 'moderate',
        priorities: ['energy'],
        symptoms: ['low-energy', 'poor-sleep'],
      }),
    );
    localStorage.setItem('dc_quizComplete', 'true');
    localStorage.setItem('dc_theme', 'dark'); // Force dark mode for screenshots
  });
}

test.beforeEach(async ({ page }) => {
  await seedSession(page);
});

const pagesToTest = [
  { name: 'Landing', path: '/' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Profile', path: '/profile' },
  { name: 'Upload', path: '/upload' },
  { name: 'Topics', path: '/topics' },
  { name: 'Topic Detail (Testosterone)', path: '/topics/testosterone' },
];

for (const { name, path } of pagesToTest) {
  test(`mobile layout: no horizontal overflow on ${name}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000); // Wait for any animations to settle

    const { scrollWidth, innerWidth, clippedElements } = await page.evaluate(() => {
      const sw = document.documentElement.scrollWidth;
      const iw = window.innerWidth;
      
      // Find all elements that might be overflowing the screen width, ignoring
      // elements explicitly placed inside an overflow-x scroll/hidden container.
      const elements = Array.from(document.querySelectorAll('*'));
      const overflowingElements = [];
      
      for (const el of elements) {
        if (el === document.documentElement || el === document.body) continue;
        const rect = el.getBoundingClientRect();
        if (rect.right > iw) {
          // Check if parent has overflow handled
          let parent = el.parentElement;
          let handled = false;
          while (parent && parent !== document.documentElement) {
            const overflow = window.getComputedStyle(parent).overflowX;
            if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden' || overflow === 'clip') {
              handled = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (!handled) {
            overflowingElements.push({
              tag: el.tagName,
              className: el.className,
              right: rect.right,
              text: el.textContent?.substring(0, 30)
            });
          }
        }
      }
      return { scrollWidth: sw, innerWidth: iw, clippedElements: overflowingElements };
    });

    if (clippedElements.length > 0) {
      console.log(`Overflowing elements on ${name}:`, clippedElements);
    }
    
    expect(scrollWidth, `Page ${name} has horizontal overflow`).toBeLessThanOrEqual(innerWidth);
    expect(clippedElements.length, `Page ${name} has elements exceeding viewport width without an overflow container`).toBe(0);

    // We can also take screenshots in dark mode for manual review later
    // Removing fullPage: true because some pages (Landing/Topics) are extremely long and exceed Playwright's 32767px limit.
    await page.screenshot({ path: `test-results/mobile-${name.replace(/ /g, '-').toLowerCase()}.png` });
  });
}
