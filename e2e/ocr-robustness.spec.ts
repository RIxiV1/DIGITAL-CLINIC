import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * OCR robustness bench — guards the image path against the regression class
 * "someone improved preprocessing and broke phone photos".
 *
 * WHY THIS EXISTS
 * ---------------
 * The parser is the product: everything on-device depends on reading the
 * report without an API. But no unit test can see OCR quality — the pipeline
 * needs a real canvas, real WASM and a real recogniser, and jsdom has none of
 * them. So preprocessing was, for a long time, unmeasurable.
 *
 * It was also wrong. A luma → Otsu → hard-binarize step, added in good faith
 * to fix a real bug (tinted lab templates reading "12.00" as "Taw"), was
 * quietly destroying ordinary phone photos: a mildly soft, slightly tilted,
 * shadowed frame extracted 1 of 8 markers. Removing the threshold and adding
 * an upscale + unsharp took the same frame to 6 of 8. 712 unit tests passed
 * throughout, before and after — none of them could tell.
 *
 * WHAT IT DOES AND DOESN'T PROVE
 * ------------------------------
 * The report LAYOUT is synthetic, so this proves nothing about whether we
 * read a Thyrocare/SRL/Metropolis template — only a real-report corpus can
 * (see extraction.corpus.test.ts). What it models is the OPTICS of a capture
 * — softness, skew, lighting, resolution — which are universal, and which
 * were what was actually broken.
 *
 * Thresholds below sit under the measured scores with headroom, so this
 * fails on a real regression rather than on recogniser jitter. They are
 * floors, not targets: if you improve the pipeline, raise them.
 *
 * Slow by nature (a real OCR pass per case). Not in the default gate —
 * runs via `npm run test:e2e`.
 */

/** Ground truth. `platelets` is printed in Lakh/cumm — the Indian
 *  convention — so it also exercises the unit reconciliation. */
const ROWS = [
  ['HAEMOGLOBIN', '14.2', 'g/dL', '13.0 - 17.0'],
  ['WBC COUNT', '7800', '/cumm', '4000 - 11000'],
  ['PLATELET COUNT', '2.50', 'Lakh/cumm', '1.5 - 4.5'],
  ['GLUCOSE FASTING', '96', 'mg/dL', '70 - 100'],
  ['TOTAL CHOLESTEROL', '180', 'mg/dL', '125 - 200'],
  ['HDL CHOLESTEROL', '55', 'mg/dL', '40 - 60'],
  ['LDL CHOLESTEROL', '90', 'mg/dL', '0 - 100'],
  ['TRIGLYCERIDES', '150', 'mg/dL', '0 - 150'],
];

/**
 * What the confirm screen must end up showing, per marker.
 *
 * Scored against the VALUE INPUTS, not page text. Two reasons: input values
 * never appear in innerText (so text scraping reads 0 even on a perfect
 * parse), and page text is full of decoys — the reference range "Normal
 * 0–150 mg/dL" contains "150", so a text match on Triglycerides passes even
 * when nothing was read at all.
 *
 * `label` is anchored to the start of the aria-label so `HDL` cannot be
 * satisfied by `Non-HDL Cholesterol`. `platelets` is the unit-reconciliation
 * check: the report prints 2.50 Lakh/cumm and we must land on 250000.
 */
const EXPECT: Record<string, { label: RegExp; value: number }> = {
  hb: { label: /^(haemoglobin|hemoglobin)/i, value: 14.2 },
  wbc: { label: /^(wbc|white blood)/i, value: 7800 },
  platelets: { label: /^platelet/i, value: 250000 },
  glucose: { label: /^(fasting )?glucose/i, value: 96 },
  'total-chol': { label: /^total cholesterol/i, value: 180 },
  hdl: { label: /^hdl\b/i, value: 55 },
  ldl: { label: /^ldl\b/i, value: 90 },
  tg: { label: /^triglyceride/i, value: 150 },
};

/** Canvas degradations, in-browser. Each models one real capture fault. */
const DEGRADE: Record<string, string> = {
  clean: `()=>{}`,
  // A shadow falling across the page. Global thresholding's classic failure —
  // and, measured, never actually ours.
  shadow: `(c,x)=>{ const g=x.createLinearGradient(0,0,c.width,c.height);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.55)');
    x.fillStyle=g; x.fillRect(0,0,c.width,c.height); }`,
  blur: `(c,x)=>{ const d=document.createElement('canvas'); d.width=c.width; d.height=c.height;
    const dx=d.getContext('2d'); dx.filter='blur(1.4px)'; dx.drawImage(c,0,0);
    x.filter='none'; x.drawImage(d,0,0); }`,
  lowres: `(c,x)=>{ const d=document.createElement('canvas'); d.width=c.width*0.45; d.height=c.height*0.45;
    d.getContext('2d').drawImage(c,0,0,d.width,d.height);
    x.imageSmoothingEnabled=true; x.clearRect(0,0,c.width,c.height);
    x.drawImage(d,0,0,c.width,c.height); }`,
  // Coloured cells behind the table — the bug the old binarization was added
  // for. Must keep passing WITHOUT it, which is the evidence that the luma
  // conversion (not the threshold) was what ever fixed it.
  tinted: `(c,x)=>{ x.globalCompositeOperation='multiply';
    x.fillStyle='#cfe3f7'; x.fillRect(0,210,c.width,c.height-210);
    x.fillStyle='#e8f0d8'; x.fillRect(560,210,300,c.height-210);
    x.globalCompositeOperation='source-over'; }`,
  // The one that matters: an actual handheld photo — soft, slightly tilted,
  // unevenly lit. Scored 1/8 before this pipeline existed.
  realistic: `(c,x)=>{ const d=document.createElement('canvas'); d.width=c.width; d.height=c.height;
    const dx=d.getContext('2d'); dx.filter='blur(0.8px)'; dx.drawImage(c,0,0);
    x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height);
    x.save(); x.translate(c.width/2,c.height/2); x.rotate(1.5*Math.PI/180);
    x.drawImage(d,-c.width/2,-c.height/2); x.restore();
    const g=x.createLinearGradient(0,0,c.width,0);
    g.addColorStop(0,'rgba(0,0,0,0.30)'); g.addColorStop(0.5,'rgba(0,0,0,0)');
    g.addColorStop(1,'rgba(0,0,0,0.22)'); x.fillStyle=g; x.fillRect(0,0,c.width,c.height); }`,
};

/**
 * Floors — one below the measured score, so a real regression fails and
 * recogniser jitter doesn't. "before" is the pipeline as it stood before the
 * upscale + grayscale + unsharp + second-pass + OCR-tolerant-unit work (it
 * binarized, and did nothing else).
 *
 *              before   now   floor
 *   clean         7      8      7
 *   shadow        6      7      6
 *   tinted        7      8      7    <- must hold WITHOUT binarization
 *   blur          7      8      7
 *   lowres        0      6      5    <- the second pass earns this
 *   realistic     0      8      7    <- the unsharp + unit gate earn this
 *
 * lowres and realistic are the ones that matter: both read NOTHING before.
 * If either drops back toward zero, someone has undone the two-pass, the
 * unsharp, or the unit tolerance — and this test is the only thing that will
 * say so.
 */
const FLOOR: Record<string, number> = {
  clean: 7,
  shadow: 6,
  tinted: 7,
  blur: 7,
  lowres: 5,
  realistic: 7,
};

const PAGE = `
<body style="margin:0;background:#fff">
<canvas id="c" width="1240" height="1754"></canvas>
<script>
const rows = ${JSON.stringify(ROWS)};
const c = document.getElementById('c'), x = c.getContext('2d');
x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height);
x.fillStyle='#111'; x.font='bold 30px Arial';
x.fillText('SUNRISE DIAGNOSTICS', 70, 80);
x.font='20px Arial'; x.fillStyle='#444';
x.fillText('Patient: Rahul Sharma   Age/Sex: 34/M   Ref: Dr. Mehta', 70, 118);
x.strokeStyle='#999'; x.beginPath(); x.moveTo(70,140); x.lineTo(1170,140); x.stroke();
x.fillStyle='#111'; x.font='bold 22px Arial';
x.fillText('TEST',70,185); x.fillText('RESULT',620,185);
x.fillText('UNITS',810,185); x.fillText('REF. RANGE',970,185);
x.beginPath(); x.moveTo(70,200); x.lineTo(1170,200); x.stroke();
let y=250;
for (const r of rows) {
  x.font='22px Arial'; x.fillStyle='#111'; x.fillText(r[0],70,y);
  x.font='bold 22px Arial'; x.fillText(r[1],620,y);
  x.font='22px Arial'; x.fillStyle='#444'; x.fillText(r[2],810,y); x.fillText(r[3],970,y);
  y+=58;
}
window.__ready = true;
</script></body>`;

async function renderDegraded(
  context: BrowserContext,
  kind: string,
): Promise<Buffer> {
  const p = await context.newPage();
  await p.setContent(PAGE);
  await p.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready);
  await p.evaluate((src) => {
    const c = document.getElementById('c') as HTMLCanvasElement;
    // eslint-disable-next-line no-eval
    eval('(' + src + ')')(c, c.getContext('2d'));
  }, DEGRADE[kind]);
  const b64 = await p.evaluate(
    () =>
      (document.getElementById('c') as HTMLCanvasElement)
        .toDataURL('image/jpeg', 0.72)
        .split(',')[1],
  );
  await p.close();
  return Buffer.from(b64, 'base64');
}

async function extractedMarkers(page: Page, jpeg: Buffer, kind: string) {
  await page.goto('/upload');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({ name: `${kind}.jpg`, mimeType: 'image/jpeg', buffer: jpeg });
  await page.getByRole('button', { name: /start analysing/i }).first().click();
  // Settle on the confirm screen's status pill, or on any failure view.
  // Do NOT match on the headline: it has two shapes ("We interpreted N
  // results" when every row matched the catalog, "We read N results — and
  // interpret M of them" when some didn't), and matching one of them
  // silently waits forever on the other.
  await page.waitForFunction(
    () =>
      /extraction complete/i.test(document.body.innerText) ||
      /couldn|could not|try again|enter manually|no results/i.test(
        document.body.innerText,
      ),
    { timeout: 180_000 },
  );
  // Values live in per-category accordions that arrive COLLAPSED, and the
  // inputs aren't mounted until one is opened — so expand every category
  // first. Wait for the categories to exist rather than sleeping: the status
  // pill paints before the list does, and reading in that gap scores a
  // perfect parse as zero.
  const cats = page.locator('button').filter({ hasText: /\d+\s+values?\b/i });
  // Tolerate absence: a parse that read NOTHING lands on the failure view
  // with no categories at all. That's a legitimate (terrible) score of 0/8
  // and must be reported as such — throwing here would surface a real
  // regression as an opaque timeout instead of a number.
  await cats.first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  for (const btn of await cats.all()) await btn.click().catch(() => {});
  const inputs = page.locator('input[type=number]');
  await inputs.first().waitFor({ state: 'attached', timeout: 15_000 }).catch(() => {});

  const readings = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input[type=number]')).map((el) => ({
      label: (el.getAttribute('aria-label') ?? '').trim(),
      value: (el as HTMLInputElement).value,
    })),
  );
  if (process.env.OCR_DUMP) {
    const dis = page.getByText(/show what we read from the file/i).first();
    if (await dis.count()) await dis.click().catch(() => {});
    const t = await page.evaluate(() => document.body.innerText);
    const i = t.search(/show what we read/i);
    console.log(`\n===== RAW OCR [${kind}] =====\n${t.slice(i, i + 800)}\n=====`);
  }

  return Object.entries(EXPECT)
    .filter(([, { label, value }]) =>
      readings.some(
        (r) =>
          label.test(r.label) &&
          Number.isFinite(Number(r.value)) &&
          // Relative tolerance: OCR either read the digits or it didn't;
          // this only absorbs unit-conversion rounding (e.g. Lakh → count).
          Math.abs(Number(r.value) - value) <= Math.max(0.05, value * 0.005),
      ),
    )
    .map(([id]) => id);
}

test.describe('OCR survives real capture faults', () => {
  test.skip(
    !!process.env.CI,
    'Needs the vendored ~16MB Tesseract assets (npm run vendor:ocr) and a real OCR pass per case.',
  );

  for (const [kind, floor] of Object.entries(FLOOR)) {
    test(`${kind}: extracts at least ${floor}/8 markers`, async ({ page, context }) => {
      test.setTimeout(240_000); // cold Tesseract init + a full recognise pass
      const jpeg = await renderDegraded(context, kind);
      const found = await extractedMarkers(page, jpeg, kind);
      const missing = Object.keys(EXPECT).filter((k) => !found.includes(k));
      // Always report the score, not just on failure — the floors are meant
      // to be re-tuned against real numbers, and a passing test that hides
      // its margin is useless for that.
      console.log(
        `[ocr-bench] ${kind}: ${found.length}/8 (missing: ${missing.join(', ') || 'none'})`,
      );
      expect(
        found.length,
        `${kind}: found ${found.length}/8 (missing: ${missing.join(', ') || 'none'})`,
      ).toBeGreaterThanOrEqual(floor);
    });
  }
});
