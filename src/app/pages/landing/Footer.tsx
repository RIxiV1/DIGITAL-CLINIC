import { useState } from 'react';
import { FlaskConical, Lock } from 'lucide-react';
import Logo from '../../components/Logo';
import LegalModal, { type LegalKind } from '../../components/LegalModal';

/** Footer link/button — min-h-11 gives every entry a 44px touch target
 *  (the visible text stays small; the hit area doesn't). Shared so the
 *  Product anchors and the Company legal buttons read identically. */
const linkCls =
  'inline-flex items-center min-h-11 text-ink-soft hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 rounded-sm';

const COMPANY: ReadonlyArray<[LegalKind, string]> = [
  ['about', 'About'],
  ['privacy', 'Privacy'],
  ['terms', 'Terms'],
  ['contact', 'Contact'],
];

export default function Footer() {
  const [legal, setLegal] = useState<LegalKind | null>(null);
  return (
    <footer className="border-t border-line/70 bg-surface">
      {/* grid-cols-2 on mobile so the two link columns sit side-by-side
          (was a sparse single stack with big gaps); the brand block spans
          both. md keeps the original 4-col layout. */}
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 py-10 md:py-12 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 text-caption">
        <div className="col-span-2">
          <Logo />
          <p className="mt-3 text-ink-soft max-w-xs leading-relaxed">
            Men’s hormonal health, finally explained. By ForMen.
          </p>
          {/* Trust badges stack on mobile — a flex row forced the second
              badge to wrap mid-phrase ("…hormone / science"). Inline on
              sm+ with the dot separator restored. */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={13} aria-hidden /> Anonymous by default
            </span>
            <span className="hidden sm:inline" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FlaskConical size={13} aria-hidden /> Grounded in men’s hormone
              science
            </span>
          </div>
        </div>

        <nav aria-label="Product links">
          <div className="font-semibold text-ink mb-1">Product</div>
          <ul>
            <li>
              <a href="#connection" className={linkCls}>
                The connection
              </a>
            </li>
            <li>
              <a href="#how" className={linkCls}>
                How it works
              </a>
            </li>
            <li>
              <a href="#report" className={linkCls}>
                What you’ll get
              </a>
            </li>
          </ul>
        </nav>

        <nav aria-label="Company links">
          <div className="font-semibold text-ink mb-1">Company</div>
          <ul>
            {COMPANY.map(([kind, label]) => (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => setLegal(kind)}
                  className={linkCls}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 py-5 border-t border-line/70 text-caption text-muted flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
        <span>
          © {new Date().getFullYear()} ForMen · Digital Clinic. All rights
          reserved.
        </span>
        <span>Educational use only. Not a replacement for a doctor.</span>
      </div>
      <LegalModal kind={legal} onClose={() => setLegal(null)} />
    </footer>
  );
}
