import { useState } from 'react';
import { FlaskConical, Lock } from 'lucide-react';
import Logo from '../../components/Logo';
import LegalModal, { type LegalKind } from '../../components/LegalModal';

export default function Footer() {
  const [legal, setLegal] = useState<LegalKind | null>(null);
  return (
    <footer className="border-t border-line/70 bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-caption">
        <div className="sm:col-span-2">
          <Logo />
          <p className="mt-3 text-ink-soft max-w-xs leading-relaxed">
            Men’s hormonal health, finally explained. By ForMen.
          </p>
          <div className="mt-4 flex items-center gap-3 text-caption text-muted">
            <span className="inline-flex items-center gap-1">
              <Lock size={12} /> Anonymous by default
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <FlaskConical size={12} /> Grounded in men’s hormone science
            </span>
          </div>
        </div>
        <div>
          <div className="font-semibold text-ink mb-3">Product</div>
          <ul className="space-y-2 text-ink-soft">
            <li>
              <a href="#connection" className="hover:text-ink">
                The connection
              </a>
            </li>
            <li>
              <a href="#how" className="hover:text-ink">
                How it works
              </a>
            </li>
            <li>
              <a href="#report" className="hover:text-ink">
                What you’ll get
              </a>
            </li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-ink mb-3">Company</div>
          <ul className="space-y-2 text-ink-soft">
            <li>
              <button
                type="button"
                onClick={() => setLegal('about')}
                className="hover:text-ink"
              >
                About
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setLegal('privacy')}
                className="hover:text-ink"
              >
                Privacy
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setLegal('terms')}
                className="hover:text-ink"
              >
                Terms
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setLegal('contact')}
                className="hover:text-ink"
              >
                Contact
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 py-6 border-t border-line/70 text-caption text-muted flex flex-wrap items-center justify-between gap-3">
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
