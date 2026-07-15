import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigation } from '../../AppContext';
import { pageToPath } from '../../contexts/NavigationContext';
import { Reveal, SectionHeader } from './shared';

// The three privacy promises — recast from lucide icon-cards (the same stock
// pattern removed from WhatYoullGet) into a hairline strip that extends the
// security_protocol matrix voice: a mono key in the clay accent, a bold title,
// plain body. No icon squares, no card fills, no shadows, no hover-lift.
const PROMISES = [
  {
    tag: 'ON_DEVICE',
    title: 'Parsed on your device',
    body: 'Your PDF or photo is read right here in this browser — the numbers are extracted on your phone, not on a server. The file never gets uploaded to us.',
  },
  {
    tag: 'NO_ACCOUNT',
    title: 'No account, ever',
    body: "No email, no password, no sign-up wall. You're anonymous from the first tap. There's no profile of you sitting in a database somewhere.",
  },
  {
    tag: 'LOCAL_ONLY',
    title: 'You hold the data',
    body: "Results are stored only on this device, in this browser. Clear them whenever you like — there's nothing on our end to delete, because we never had it.",
  },
];

/**
 * Privacy section — the product's single biggest differentiator, and one
 * it was barely making. Every competitor here wants an account and an
 * upload to their servers; this app reads the report on-device and keeps
 * it there. That's a real trust weapon, so it gets its own section with
 * three concrete, verifiable promises (not vague "we value your privacy"
 * filler). Placed right after the science/receipts so "why trust this"
 * reads as one block before the page asks for an upload.
 */
export default function Privacy() {
  const { navigate } = useNavigation();
  return (
    <section
      id="privacy"
      className="py-16 sm:py-20 md:py-28 bg-canvas border-t border-line/60"
    >
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <Reveal>
            <SectionHeader
              eyebrow="Your privacy"
              title="Your report is read on your device, not on our servers."
              subtitle="No account to create, nothing uploaded to us. The whole thing runs in your browser — because a lab report is nobody else's business. The one exception: if a photo is too blurry to read, you can choose to send it to Google's AI. It never happens unless you ask."
            />
          </Reveal>
          <Reveal delay={0.1}>
            {/* Security Protocol Matrix — replaces the stock privacy
                illustration with the actual architecture, written into the
                layout. EVERY value here is verified against the source
                (crypto.ts / persistence.ts), NOT marketing: the cipher is
                AES-GCM-256, the KDF is PBKDF2-SHA256 @ 200k iterations (NOT
                Argon2id), encryption is PIN-gated/opt-in, and data persists
                to localStorage (so no "zero-storage" claim). No invented
                compliance seals — authority comes from precision. */}
            <div className="w-full max-w-sm mx-auto md:ml-auto font-mono">
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
                  {(
                    [
                      ['PROCESSING', 'ON_DEVICE'],
                      ['SERVER_UPLOAD', 'NONE'],
                      ['ACCOUNT', 'NONE'],
                      ['STORAGE', 'BROWSER_LOCAL'],
                      ['ENCRYPTION', 'AES-GCM-256 · OPT-IN'],
                      ['KEY_DERIVATION', 'PBKDF2-SHA256 · 200K'],
                    ] as const
                  ).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-baseline justify-between gap-3 px-3.5 py-2.5"
                    >
                      <dt className="uppercase text-muted whitespace-nowrap">
                        {k}
                      </dt>
                      <dd className="text-ink-soft text-right">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {/* Real <a href> so the dedicated /privacy page is crawlable +
                  shareable; onClick keeps it an in-app SPA navigation
                  (preventDefault stops the full reload). */}
              <a
                href={pageToPath({ type: 'privacy' })}
                onClick={(e) => {
                  e.preventDefault();
                  navigate({ type: 'privacy' });
                }}
                className="group mt-4 inline-flex items-center gap-1.5 text-caption font-semibold text-clay hover:opacity-70 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/60 rounded-sm"
              >
                Read the full security model
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-12 md:mt-16 border-y border-line grid md:grid-cols-3">
            {PROMISES.map(({ tag, title, body }, i) => (
              <div
                key={tag}
                className={`py-7 md:py-8 md:px-8 first:md:pl-0 last:md:pr-0 ${
                  i > 0 ? 'border-t md:border-t-0 md:border-l border-line' : ''
                }`}
              >
                <div className="font-mono text-[10px] uppercase tracking-widest text-clay">
                  {tag}
                </div>
                <h3 className="mt-3 font-sans font-bold text-body-lg leading-snug text-ink">
                  {title}
                </h3>
                <p className="mt-2.5 text-body-sm text-ink-soft leading-relaxed text-pretty">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <div className="mt-10 flex items-center justify-center gap-2 text-caption text-muted text-center max-w-2xl mx-auto">
            <ShieldCheck size={14} className="text-blue-600 shrink-0" />
            <span>
              Discreet Mode adds a privacy veil the moment you switch away —
              for the 2 a.m. read you’d rather no one glanced at.
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

