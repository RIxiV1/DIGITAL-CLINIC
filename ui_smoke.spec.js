import { test, expect } from '@playwright/test';
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

test.describe('Digital Clinic UI Smoke Tests', () => {

  test('Quiz and Dashboard Flow', async ({ page }) => {
    console.log('=== STARTING QUIZ & DASHBOARD FLOW ===');
    
    // Go to landing page
    await page.goto('http://localhost:5173/');
    console.log('Navigated to landing page:', page.url());
    
    // Verify Hero elements
    await expect(page.getByRole('button', { name: /find out in 3 minutes/i }).first()).toBeVisible();
    await page.screenshot({ path: 'landing-page.png' });
    console.log('Landing page loaded and screenshot captured.');

    // Start Quiz
    await page.getByRole('button', { name: /find out in 3 minutes/i }).first().click();
    await page.waitForURL(/.*quiz.*/);
    console.log('Navigated to quiz page:', page.url());

    // Step 1: Symptoms
    await page.waitForTimeout(1000);
    const lowEnergyBtn = page.getByRole('button', { name: /low energy/i }).first();
    await expect(lowEnergyBtn).toBeVisible();
    await lowEnergyBtn.click();
    console.log('Selected Low Energy symptom');
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 2: Priorities
    await page.waitForTimeout(1000);
    const hormonalBtn = page.getByRole('button', { name: /overall hormonal health/i }).first();
    await expect(hormonalBtn).toBeVisible();
    await hormonalBtn.click();
    console.log('Selected Overall hormonal health priority');
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 3: Basics (Age & Activity)
    await page.waitForTimeout(1000);
    const ageOption = page.getByRole('button', { name: '25–34', exact: true }).first();
    await expect(ageOption).toBeVisible();
    await ageOption.click();
    console.log('Selected Age: 25-34');

    const activityOption = page.getByRole('button', { name: /^active/i }).first();
    await expect(activityOption).toBeVisible();
    await activityOption.click();
    console.log('Selected Activity: Active');
    await page.getByRole('button', { name: /see my plan/i }).click();

    // Wait for recommended tests page
    await page.waitForURL(/.*tests.*/, { timeout: 15000 });
    console.log('Navigated to recommended tests page:', page.url());
    await page.screenshot({ path: 'recommended-tests.png' });

    // Go to Dashboard
    const dashboardBtn = page.getByRole('button', { name: /skip — go to my dashboard/i }).first();
    await expect(dashboardBtn).toBeVisible();
    await dashboardBtn.click();
    await page.waitForURL(/.*dashboard.*/);
    console.log('Navigated to Dashboard:', page.url());
    await page.screenshot({ path: 'dashboard.png' });
  });

  test('Manual Entry and Results Flow', async ({ page }) => {
    console.log('=== STARTING MANUAL ENTRY FLOW ===');
    
    // Go to manual entry page
    await page.goto('http://localhost:5173/manual-entry');
    console.log('Navigated to manual entry page:', page.url());
    await expect(page.getByRole('heading', { name: /type in the values/i })).toBeVisible();

    // Set Report Name
    const nameInput = page.locator('#report-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('E2E Smoke Test Report');
    console.log('Set report name.');

    // Fill Fasting Glucose and HbA1c in Metabolic (expanded by default)
    const glucoseInput = page.locator('#entry-glucose');
    await expect(glucoseInput).toBeVisible();
    await glucoseInput.fill('95');
    console.log('Entered Glucose: 95');

    const hba1cInput = page.locator('#entry-hba1c');
    await expect(hba1cInput).toBeVisible();
    await hba1cInput.fill('5.4');
    console.log('Entered HbA1c: 5.4');

    // Wait 500ms for state propagation
    await page.waitForTimeout(500);

    // Click "See my report"
    const seeReportBtn = page.getByRole('button', { name: /see my report/i }).first();
    await seeReportBtn.click();
    await page.waitForURL(/.*reports.*/);
    console.log('Navigated to report results page:', page.url());

    // Verify values on report results page
    await expect(page.locator('text=E2E Smoke Test Report')).toBeVisible();
    await page.screenshot({ path: 'manual-report-results.png' });
    console.log('Manual entry test complete.');
  });

  test('PDF Report Upload and Parse Flow', async ({ page }) => {
    console.log('=== STARTING PDF REPORT UPLOAD FLOW ===');

    // 1. Generate a mock PDF file using jspdf
    const pdfPath = path.resolve('mock_lab_report.pdf');
    const doc = new jsPDF();
    doc.text("Thyrocare Technologies", 10, 10);
    doc.text("Total Cholesterol 185 mg/dL", 10, 20);
    doc.text("Hemoglobin 14.5 g/dL", 10, 30);
    doc.text("WBC 7200 cells/mcL", 10, 40);
    
    // Save to disk
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log('Created mock PDF at:', pdfPath);

    try {
      // 2. Go to upload page
      await page.goto('http://localhost:5173/upload');
      console.log('Navigated to upload page:', page.url());
      await expect(page.locator('text=Upload a report')).toBeVisible();

      // 3. Upload the file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(pdfPath);
      console.log('Uploaded mock PDF file.');

      // Wait for name to display
      await expect(page.locator('text=mock_lab_report')).toBeVisible();
      await page.screenshot({ path: 'upload-file-selected.png' });

      // 4. Click "Start analysing"
      const startBtn = page.getByRole('button', { name: /start analysing/i }).first();
      await startBtn.click();
      await page.waitForURL(/.*processing.*/);
      console.log('Processing page loaded:', page.url());
      await page.screenshot({ path: 'processing-animation.png' });

      // 5. Wait for parsing to finish (shows confirmation screen on /processing)
      console.log('Waiting for analysis processing to complete...');
      const looksRightBtn = page.getByRole('button', { name: /looks right — see my report/i }).first();
      await expect(looksRightBtn).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'extraction-confirm.png' });

      // 6. Click confirmation CTA to go to results view
      await looksRightBtn.click();
      await page.waitForURL(/.*reports.*/);
      console.log('Navigated to report results page after confirmation:', page.url());
      
      // 7. Verify parsed values on screen
      await page.screenshot({ path: 'parsed-report-results.png' });
      await expect(page.locator('text=Parsed from upload')).toBeVisible();
      console.log('PDF upload and parse test complete.');
    } finally {
      // Cleanup file
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
        console.log('Cleaned up mock PDF file.');
      }
    }
  });
});
