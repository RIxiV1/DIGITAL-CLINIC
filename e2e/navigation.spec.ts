import { test, expect, type Page } from '@playwright/test';

/**
 * Real-browser guards for client-side navigation.
 *
 * Background: PageHost used to wrap the page swap in
 * <AnimatePresence mode="popLayout">, but the pages never fired
 * framer-motion's exit-complete callback, so the exiting page was left
 * mounted — absolutely positioned ON TOP of the live page, intercepting
 * taps and breaking scroll. It felt like an unresponsive "infinite
 * scroll" after an in-app nav such as Sign out, and only ever reproduced
 * in a real browser (jsdom resolves framer-motion exits synchronously).
 *
 * These tests fail if that class of bug returns: extra <main> elements,
 * climbing DOM node counts across navigations, or the previous page's
 * content lingering after a navigation.
 */

// Seed a realistic "returning user" session so the dashboard/profile
// render their full surfaces (BottomNav, etc.) instead of empty states.
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
  });
}

function counts(page: Page) {
  return page.evaluate(() => ({
    mains: document.querySelectorAll('main#main-content').length,
    navs: document.querySelectorAll('nav').length,
    nodes: document.querySelectorAll('*').length,
  }));
}

test.beforeEach(async ({ page }) => {
  await seedSession(page);
});

test('in-app navigation never leaves a ghost page (no DOM leak)', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const base = await counts(page);
  expect(base.mains).toBe(1);

  // Bounce between tabs via the bottom nav (real client-side navigation).
  // .last() targets the live page's nav even if a regression briefly
  // mounts two.
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('Profile', { exact: true }).last().click();
    await page.waitForTimeout(450);
    await page.getByLabel('Home', { exact: true }).last().click();
    await page.waitForTimeout(450);

    const c = await counts(page);
    // Exactly one page main and one bottom nav at rest — no ghost.
    expect(c.mains, `cycle ${i}: page main count`).toBe(1);
    expect(c.navs, `cycle ${i}: nav count`).toBe(1);
    // DOM must not grow unboundedly (allow a tiny constant for transient
    // motion/layout state; the leak added ~190 nodes per cycle).
    expect(c.nodes, `cycle ${i}: node count`).toBeLessThan(base.nodes + 40);
  }
});

test('Sign out lands on the full landing page with no Profile leftover', async ({ page }) => {
  await page.goto('/profile', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();

  // Landing content shows and Profile content is gone.
  await expect(page.getByText(/men.s hormonal health/i).first()).toBeVisible();
  await expect(page.getByText(/Account & preferences/i)).toHaveCount(0);

  // Exactly one page main, and the page is the full landing surface (a
  // lingering Profile overlay would leave a second main / shorter scroll).
  expect(await counts(page)).toMatchObject({ mains: 1 });
  const scrollH = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(scrollH).toBeGreaterThan(3000);
});
