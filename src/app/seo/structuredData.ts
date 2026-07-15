/**
 * Schema.org structured data (JSON-LD) for rich-result eligibility.
 *
 * WHY INJECTED, NOT INLINE IN index.html: the production CSP
 * (`script-src 'self' 'wasm-unsafe-eval' …`, NO 'unsafe-inline' — see
 * vercel.json) blocks inline executable scripts, which is why theme-init
 * is an external file. A `<script type="application/ld+json">` is a data
 * block (never executed), so inserting it from app code doesn't trip the
 * script-src execution rule, and Googlebot — which already renders this
 * client-rendered SPA to see ANY content — picks it up after hydration.
 *
 * WHAT WE DELIBERATELY DO NOT EMIT:
 *   - `MedicalBusiness` / `MedicalOrganization` — we are a screening tool,
 *     not a clinic with a licence + physical premises. Claiming it would
 *     be a false medical-entity signal.
 *   - `FAQPage` — Google requires the Q&A to be visibly present on the
 *     page; there is no FAQ section, so the markup would be non-compliant.
 *   - `aggregateRating` / `review` — there are no real ratings. The whole
 *     product refuses invented social proof; fabricating it here too would
 *     contradict that and risk a structured-data manual action.
 *
 * Every field below is factually true of the deployed app.
 */

const SITE_URL = 'https://digital-clinic-formen.vercel.app';

const DESCRIPTION =
  "Men's hormonal health, explained. Upload a blood report and get a " +
  'plain-language read of what each marker means — parsed on your ' +
  'device, no account, nothing stored on our servers. A screening aid, ' +
  'not a diagnosis.';

function buildGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'ForMen · Digital Clinic',
        url: SITE_URL,
        logo: `${SITE_URL}/icon-192.png`,
        description:
          'Men’s hormonal health, finally explained — an ' +
          'on-device tool that translates lab reports into plain language.',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'ForMen · Digital Clinic',
        description: DESCRIPTION,
        inLanguage: 'en-IN',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#webapp`,
        name: 'ForMen · Digital Clinic',
        url: SITE_URL,
        applicationCategory: 'HealthApplication',
        operatingSystem: 'Web browser',
        browserRequirements: 'Requires JavaScript.',
        inLanguage: 'en-IN',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
        featureList: [
          'On-device lab-report parsing (PDF text + OCR, no upload)',
          'Plain-language explanation of each biomarker',
          'Healthy-range and optimal-range context with cited sources',
          'Trend tracking across re-tests',
          'Printable one-page doctor summary',
          'Optional PIN-based at-rest encryption (AES-GCM-256)',
        ],
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };
}

const SCRIPT_ID = 'ld-json-app';

/**
 * Insert the JSON-LD block into <head> once. Idempotent (id-guarded) so a
 * StrictMode double-invoke or an accidental second call can't duplicate it.
 */
export function injectStructuredData(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SCRIPT_ID)) return;
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.id = SCRIPT_ID;
  el.textContent = JSON.stringify(buildGraph());
  document.head.appendChild(el);
}
