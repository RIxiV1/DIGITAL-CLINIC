/**
 * Copies the OCR/PDF runtime assets out of node_modules and into public/, so
 * they are served same-origin instead of being fetched from cdn.jsdelivr.net
 * at runtime.
 *
 * WHY THIS EXISTS
 * ---------------
 * tesseract.js defaults `workerPath`, `corePath` and `langPath` to jsdelivr,
 * and pdf.js's `cMapUrl` pointed there too. That meant the browser downloaded
 * and EXECUTED a worker script from a third party, inside our origin, while
 * holding the user's lab report in memory. Three problems:
 *
 *   1. Supply chain. A jsdelivr compromise (or DNS/BGP hijack) would run
 *      arbitrary code with access to the report. A worker loaded this way
 *      can't carry an SRI hash, so there was no integrity check available.
 *   2. Honesty. The product promises "your report never leaves your device".
 *      The report's CONTENTS never did — but OCR still called a third party,
 *      handing it the user's IP and the fact that they're parsing a health
 *      document. That asterisk was never disclosed.
 *   3. Availability. jsdelivr is blocked on plenty of ISP/corporate networks
 *      (this is an India-first product), and unreachable offline — where a
 *      PWA is expected to work. When it's blocked, OCR simply fails.
 *
 * Serving these from our own origin removes all three at once, and lets the
 * CSP drop jsdelivr entirely (see vercel.json): script-src becomes 'self'.
 *
 * WHY A COPY STEP, NOT A COMMIT
 * -----------------------------
 * These are ~16MB of binaries. Copying them at build time keeps them out of
 * git and — more importantly — keeps them permanently in sync with the
 * installed package versions. Vendoring by hand would silently rot the first
 * time someone bumps tesseract.js. Output is gitignored; `prebuild`/`predev`
 * run this automatically, so there's no way to deploy without it.
 *
 * WHAT GETS COPIED (and why exactly these files)
 * ----------------------------------------------
 * The call is `createWorker('eng')`, and tesseract.js's signature is
 * `createWorker(langs = 'eng', oem = OEM.LSTM_ONLY, ...)`. So `lstmOnly` is
 * true, which pins two things:
 *   - getCore() feature-detects SIMD and imports exactly one of the three
 *     `*-lstm.wasm.js` files below. The non-LSTM cores are unreachable, so
 *     they aren't copied.
 *   - the language data is the `4.0.0_best_int` variant (2.9MB), not the
 *     11MB `4.0.0` one that also carries the legacy model.
 * The `.wasm.js` glue files embed their wasm as base64 and never fetch a
 * sibling `.wasm`, so the standalone `.wasm` binaries aren't copied either.
 *
 * If you ever change the OEM away from LSTM_ONLY, or add a language, this
 * list must grow to match — otherwise OCR 404s at runtime. The assertion at
 * the bottom exists to make that failure loud at build time, not in a user's
 * browser.
 */
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = (...p) => join(root, 'node_modules', ...p);
const pub = (...p) => join(root, 'public', ...p);

/** Each entry: [source, destination, why it's needed]. */
const ASSETS = [
  // The worker script itself. tesseract.js fetches this and wraps it in a
  // blob URL (workerBlobURL defaults to true), which is why the CSP still
  // needs `worker-src blob:` — but the fetch is now same-origin.
  [
    nm('tesseract.js', 'dist', 'worker.min.js'),
    pub('tesseract', 'worker.min.js'),
    'tesseract worker script',
  ],
  // The three SIMD tiers getCore() can pick between. Budget Android devices
  // with older Chrome fall back to the plain build, so all three ship.
  ...['', '-simd', '-relaxedsimd'].map((tier) => [
    nm('tesseract.js-core', `tesseract-core${tier}-lstm.wasm.js`),
    pub('tesseract', 'core', `tesseract-core${tier}-lstm.wasm.js`),
    `tesseract core (${tier || 'baseline'})`,
  ]),
  // English traineddata. tesseract.js sniffs the gzip magic bytes and only
  // gunzips when they're present, so this works whether the host serves the
  // .gz verbatim or transparently decompresses it.
  [
    nm('@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'),
    pub('tesseract', 'tessdata', 'eng.traineddata.gz'),
    'english language data',
  ],
  // pdf.js CMaps, for CID-keyed/CJK fonts in lab PDFs.
  [nm('pdfjs-dist', 'cmaps'), pub('cmaps'), 'pdf.js cmaps'],
];

const exists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

// Clear first so a removed/renamed upstream file can't linger and mask a
// broken copy list with a stale asset that still happens to serve.
await rm(pub('tesseract'), { recursive: true, force: true });
await rm(pub('cmaps'), { recursive: true, force: true });

const missing = [];
for (const [src, dest, label] of ASSETS) {
  if (!(await exists(src))) {
    missing.push(`${label}: ${src}`);
    continue;
  }
  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true });
}

if (missing.length) {
  console.error(
    '\nvendor-ocr-assets: expected files are missing from node_modules.\n' +
      'OCR would fall back to fetching from a CDN (or 404) at runtime, so\n' +
      'this fails the build instead. Did a package version bump move them?\n\n' +
      missing.map((m) => `  - ${m}`).join('\n') +
      '\n',
  );
  process.exit(1);
}

console.log(`vendor-ocr-assets: copied ${ASSETS.length} asset paths to public/`);
