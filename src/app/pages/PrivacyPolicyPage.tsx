import { ShieldCheck } from 'lucide-react';
import Container from '../components/Container';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

/**
 * Privacy & security — the technical deep-dive the landing's privacy
 * section links to (and the dedicated, linkable URL for "how does the
 * on-device claim actually work").
 *
 * EVERY value here is verified against the source it describes
 * (utils/crypto.ts, utils/dataLock.ts, utils/persistence.ts,
 * contexts/DiscreetContext.tsx, api/parse-image.ts) and mirrors
 * docs/SECURITY.md — the single source of truth. No invented compliance
 * seals, no "military-grade" marketing, no claim the product can't back.
 * If the crypto or the data flow changes, update SECURITY.md AND this page.
 */

/** The verified protocol facts — same vocabulary as the landing matrix. */
const PROTOCOL: ReadonlyArray<readonly [string, string]> = [
  ['PROCESSING', 'ON_DEVICE'],
  ['SERVER_UPLOAD', 'NONE'],
  ['ACCOUNT', 'NONE'],
  ['ANALYTICS', 'NONE'],
  ['STORAGE', 'BROWSER_LOCAL'],
  ['ENCRYPTION', 'AES-GCM-256 · OPT-IN'],
  ['KEY_DERIVATION', 'PBKDF2-SHA256 · 200K'],
];

const THREATS: ReadonlyArray<readonly [string, string]> = [
  [
    'A server breach leaking everyone’s reports',
    'There is no server with your data. Reports are parsed in the browser and stored locally — there’s nothing central to breach.',
  ],
  [
    'Someone with physical access to an unlocked device (a shared family phone)',
    'The opt-in PIN lock encrypts reports + quiz answers at rest; Discreet Mode veils the screen the instant the app is backgrounded.',
  ],
  [
    'A shoulder-surfer while the app is open',
    'Discreet Mode blanks all content on blur, tab-switch, or app-background.',
  ],
  [
    'A poisoned local-storage value',
    'Every load path validates against a strict schema and falls back to a safe default rather than trusting malformed data.',
  ],
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-display-md leading-tight text-ink mt-12 first:mt-0">
      {children}
    </h2>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-body-sm text-ink-soft leading-relaxed text-pretty">
      {children}
    </p>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
      <Header variant="page" title="Privacy & security" />

      <Container size="narrow" className="pt-8 md:pt-12">
        {/* Lede */}
        <div className="inline-flex items-center gap-2 text-caption font-bold uppercase tracking-eyebrow text-clay">
          <ShieldCheck size={15} className="shrink-0" />
          The architecture, not a promise
        </div>
        <h1 className="mt-3 font-display text-display-lg leading-[1.05] tracking-tight text-balance">
          Privacy isn’t a feature here. It’s how the app is built.
        </h1>
        <p className="mt-4 text-body text-ink-soft leading-relaxed max-w-[60ch]">
          This app handles some of the most sensitive data a person has —
          hormonal, metabolic, and sexual-health lab values. So the default is
          that nothing leaves your device, and the single exception is loudly
          opt-in. Here’s exactly how that works, in plain terms and in detail.
        </p>

        {/* Protocol matrix */}
        <div className="mt-8 font-mono">
          <div className="rounded-md border-[0.5px] border-line bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2 border-b-[0.5px] border-line">
              <span className="text-[10px] uppercase tracking-widest text-clay">
                security_protocol
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted">
                on_device
              </span>
            </div>
            <dl className="divide-y divide-line text-xs tracking-tight">
              {PROTOCOL.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-3 px-3.5 py-2.5"
                >
                  <dt className="uppercase text-muted whitespace-nowrap">{k}</dt>
                  <dd className="text-ink-soft text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* The default */}
        <SectionTitle>The default: 100% on-device</SectionTitle>
        <Body>
          There is no backend, no account, and no login — nothing to sign up
          for, and nothing tied to your identity. There are no analytics, no
          telemetry, and no third-party trackers.
        </Body>
        <Body>
          Your PDF or photo is read right here in the browser: PDF text
          extraction and OCR (via WebAssembly) run on your phone, and only the
          extracted numbers are kept. The file itself is never uploaded.
          Everything stored lives under a <code>dc_</code> prefix in your
          browser’s local storage and is read back through validated loaders.
          The only baseline network traffic is fetching the app and its
          parser workers — never your report.
        </Body>

        {/* At-rest encryption */}
        <SectionTitle>At-rest encryption (opt-in PIN lock)</SectionTitle>
        <Body>
          Off by default. When you set a PIN in Profile, your reports and quiz
          answers are encrypted in local storage, so anyone browsing the device
          (or its dev-tools) sees only ciphertext. It’s built on the Web Crypto
          API:
        </Body>
        <ul className="mt-3 space-y-2 text-body-sm text-ink-soft leading-relaxed">
          <li className="flex gap-2.5">
            <span className="text-clay shrink-0">·</span>
            <span>
              <strong className="font-semibold text-ink">AES-GCM, 256-bit</strong>{' '}
              for the data, with a fresh 96-bit IV per encryption.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-clay shrink-0">·</span>
            <span>
              The key is derived from your PIN via{' '}
              <strong className="font-semibold text-ink">
                PBKDF2-SHA256, 200,000 iterations
              </strong>{' '}
              plus a random per-install salt — the high work factor makes an
              offline brute-force of a short PIN expensive rather than instant.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-clay shrink-0">·</span>
            <span>
              The derived key is{' '}
              <strong className="font-semibold text-ink">
                non-extractable and lives in memory only
              </strong>
              . Neither the key nor the PIN is ever written to disk.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-clay shrink-0">·</span>
            <span>
              Unlock works without storing the PIN: a known verifier token is
              sealed with the key; on unlock we re-derive the key and try to
              decrypt it. Success means the PIN was right.
            </span>
          </li>
        </ul>
        <Body>
          The honest trade-off of real client-side encryption:{' '}
          <strong className="font-semibold text-ink">
            a forgotten PIN can’t be recovered
          </strong>
          . Because the key only ever exists in memory and is derived from the
          PIN, there’s no backdoor — the only option is “forgot PIN → wipe and
          start over.” No recovery path means no backdoor for anyone else
          either.
        </Body>

        {/* Discreet mode */}
        <SectionTitle>Discreet Mode</SectionTitle>
        <Body>
          A second, lighter layer for the “someone glanced at my screen”
          moment. When enabled, a privacy veil obscures all content the instant
          the app loses focus or is backgrounded — so a notification, an
          app-switch, or handing the phone over doesn’t expose lab values. It’s
          a UI veil, not encryption; the two are complementary.
        </Body>

        {/* The exception */}
        <SectionTitle>The one exception: the AI parser</SectionTitle>
        <Body>
          When on-device OCR can’t read a photo, you can choose to send that
          single image to Google Gemini for a second attempt. This is the only
          path where data leaves your device, and it’s treated as such: it’s off
          unless you invoke it (a per-use tap, or an opt-in auto-cascade you
          turn on), and it’s disclosed at the point of use.
        </Body>
        <Body>
          The honest caveat: it currently uses Gemini’s{' '}
          <strong className="font-semibold text-ink">
            free tier, which can use submitted data to improve Google’s
            products
          </strong>
          . So we don’t claim “your data never leaves your device” without
          qualification. The path to an airtight claim is a paid Gemini key or
          Vertex AI (neither trains on submitted data) — a known, deliberate
          next step. The API key is a server-side secret and is never shipped to
          the browser.
        </Body>

        {/* Threat model */}
        <SectionTitle>What this protects against</SectionTitle>
        <div className="mt-4 rounded-lg border border-line overflow-hidden bg-surface">
          {THREATS.map(([threat, mitigation], i) => (
            <div
              key={threat}
              className={`grid sm:grid-cols-2 gap-1 sm:gap-4 px-4 py-3.5 ${
                i > 0 ? 'border-t border-line' : ''
              }`}
            >
              <div className="text-body-sm font-semibold text-ink">{threat}</div>
              <div className="text-caption text-ink-soft leading-relaxed">
                {mitigation}
              </div>
            </div>
          ))}
        </div>
        <Body>
          What we don’t claim to defend against: a compromised browser or OS, a
          keylogger, or a malicious extension with full page access. Those
          defeat any client-side app, and it would be dishonest to pretend
          otherwise.
        </Body>

        {/* Non-goals */}
        <SectionTitle>Honest non-goals</SectionTitle>
        <ul className="mt-3 space-y-2 text-body-sm text-ink-soft leading-relaxed">
          <li className="flex gap-2.5">
            <span className="text-clay shrink-0">·</span>
            <span>
              This is a privacy-respecting screening tool, not a certified
              medical-records system. It is not HIPAA- or DPDP-audited; formal
              compliance is a separate undertaking.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-clay shrink-0">·</span>
            <span>
              Storage is device-bound by design — there’s no cross-device sync,
              because sync would mean a server holding your data.
              Export-as-PDF is the intentional way to take your data with you.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-clay shrink-0">·</span>
            <span>
              It is a screening aid, not a diagnosis. Always confirm findings
              with a qualified doctor before acting on them.
            </span>
          </li>
        </ul>

        {/* Contact */}
        <div className="mt-12 rounded-lg border border-line bg-surface px-5 py-5">
          <div className="text-micro font-bold uppercase tracking-eyebrow text-clay">
            Questions or a security report
          </div>
          <p className="mt-2 text-body-sm text-ink-soft leading-relaxed">
            Deletion requests, data questions, or a vulnerability you’ve found —
            write to{' '}
            <a
              href="mailto:privacy@formen.co.in"
              className="font-semibold text-ink underline underline-offset-2 decoration-clay/40 hover:decoration-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/60 rounded-sm"
            >
              privacy@formen.co.in
            </a>
            . Given the data this app touches, security reports are taken
            seriously.
          </p>
        </div>

        <p className="mt-6 text-caption text-muted">
          Last reviewed · June 2026 · mirrors the project’s SECURITY.md.
        </p>
      </Container>

      <BottomNav />
    </div>
  );
}
