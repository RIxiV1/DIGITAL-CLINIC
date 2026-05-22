import { chromium } from 'playwright';

(async () => {
  console.log('=== STARTING E2E SMOKE TESTS ===');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    // Test 1: Navigation to landing page and screenshot
    console.log('\n--- TEST 1: Landing Page ---');
    await page.goto('http://localhost:5173/');
    console.log('Navigated to:', page.url());
    await page.waitForSelector('text=Start free quiz');
    await page.screenshot({ path: 'landing-page.png' });
    console.log('Captured landing-page.png');

    // Test 2: Quiz Flow
    console.log('\n--- TEST 2: Quiz Flow ---');
    const startBtn = page.getByRole('button', { name: /start/i }).first();
    await startBtn.click();
    await page.waitForURL(/.*quiz.*/);
    console.log('Navigated to quiz:', page.url());

    // Step 1: Symptoms
    await page.waitForTimeout(1000);
    const lowEnergyBtn = page.getByRole('button', { name: /low energy|energy/i }).first();
    if (await lowEnergyBtn.isVisible()) {
      await lowEnergyBtn.click();
      console.log('Selected Low Energy');
    }
    const continueBtn = page.getByRole('button', { name: /continue/i });
    await continueBtn.click();

    // Step 2: Priorities
    await page.waitForTimeout(1000);
    const heartBtn = page.getByRole('button', { name: /heart health|heart/i }).first();
    if (await heartBtn.isVisible()) {
      await heartBtn.click();
      console.log('Selected Heart Health priority');
    }
    await continueBtn.click();

    // Step 3: Basics (Age & Activity)
    await page.waitForTimeout(1000);
    const ageOption = page.getByRole('button', { name: /18-35|18|35/i }).first();
    if (await ageOption.isVisible()) {
      await ageOption.click();
      console.log('Selected Age: 18-35');
    }
    const activityOption = page.getByRole('button', { name: /active|moderately/i }).first();
    if (await activityOption.isVisible()) {
      await activityOption.click();
      console.log('Selected Activity: Active');
    }
    const seePlanBtn = page.getByRole('button', { name: /see my plan|continue/i });
    await seePlanBtn.click();

    // Wait for overlay & recommended page
    console.log('Waiting for Recommended Tests Page...');
    await page.waitForURL(/.*tests.*/, { timeout: 15000 });
    console.log('Navigated to tests page:', page.url());
    await page.screenshot({ path: 'recommended-tests.png' });
    console.log('Captured recommended-tests.png');

    // Proceed to Dashboard
    const dashboardBtn = page.getByRole('button', { name: /go to dashboard|dashboard/i }).first();
    if (await dashboardBtn.isVisible()) {
      await dashboardBtn.click();
      await page.waitForURL(/.*dashboard.*/);
      console.log('Navigated to Dashboard:', page.url());
      await page.screenshot({ path: 'dashboard.png' });
      console.log('Captured dashboard.png');
    }

    // Test 3: Manual Entry
    console.log('\n--- TEST 3: Manual Entry Flow ---');
    await page.goto('http://localhost:5173/manual-entry');
    console.log('Navigated to:', page.url());
    await page.waitForSelector('text=Type in the values you have');

    // Fill in Hemoglobin
    const hbInput = page.locator('input[aria-label*="Hemoglobin"]').first();
    if (await hbInput.isVisible()) {
      await hbInput.fill('15.2');
      console.log('Entered Hemoglobin: 15.2');
    } else {
      const firstInput = page.locator('input[type="number"]').first();
      await firstInput.fill('15.2');
      console.log('Entered value in first input');
    }
    await page.screenshot({ path: 'manual-entry-filled.png' });

    // Click "See my report"
    const seeReportBtn = page.getByRole('button', { name: /see my report|save/i }).first();
    await seeReportBtn.click();
    await page.waitForURL(/.*reports.*/);
    console.log('Navigated to report results:', page.url());
    await page.screenshot({ path: 'manual-report-results.png' });
    console.log('Captured manual-report-results.png');

    console.log('\n=== ALL E2E TESTS COMPLETED SUCCESSFULLY ===');
  } catch (error) {
    console.error('TEST ERROR:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
