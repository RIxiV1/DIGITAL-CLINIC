import { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import Button from './Button';
import { acquireBodyScrollLock } from '../utils/bodyScrollLock';

export type LegalKind = 'privacy' | 'terms' | 'about' | 'contact';

type Props = {
  kind: LegalKind | null;
  onClose: () => void;
};

/**
 * Lightweight footer-link modal — handles the four "Company" links the
 * landing footer surfaces (Privacy, Terms, About, Contact). Copy is
 * intentionally MVP-grade: short, honest, and accurate for what the
 * product actually does today. Replace with formal docs when legal
 * counsel signs off.
 */
export default function LegalModal({ kind, onClose }: Props) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    const release = acquireBodyScrollLock();
    const id = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      release();
      window.clearTimeout(id);
    };
  }, [kind]);

  const doc = kind ? CONTENT[kind] : null;

  return (
    <AnimatePresence>
      {kind && doc && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-ink/40 backdrop-blur-sm p-0 sm:p-6"
          role="presentation"
        >
          <motion.div
            ref={cardRef}
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full sm:max-w-md md:max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-pop border border-line flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-line/70">
              <div className="flex-1 min-w-0">
                <div className="text-micro font-bold uppercase tracking-[0.18em] text-blue-700 mb-1">
                  {doc.eyebrow}
                </div>
                <h2
                  id={titleId}
                  className="font-display text-display-md sm:text-display-md leading-tight text-ink"
                >
                  {doc.title}
                </h2>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid place-items-center w-12 h-12 -mr-2 -mt-2 rounded-full hover:bg-canvas text-muted hover:text-ink transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {doc.sections.map((s) => (
                <section key={s.heading}>
                  <h3 className="text-micro font-bold uppercase tracking-[0.16em] text-blue-700 mb-2">
                    {s.heading}
                  </h3>
                  {s.paragraphs.map((p, i) => (
                    <p
                      key={i}
                      className="text-caption leading-relaxed text-ink-soft mt-2 first:mt-0"
                    >
                      {p}
                    </p>
                  ))}
                </section>
              ))}
              <p className="text-caption text-muted leading-relaxed pt-3 border-t border-line/70">
                Last updated · {doc.updated}. Questions? Write to{' '}
                <a
                  href="mailto:hello@formen.co.in"
                  className="text-blue-700 underline underline-offset-2 hover:text-blue-800"
                >
                  hello@formen.co.in
                </a>
                .
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-line/70 bg-canvas/40">
              <Button variant="primary" size="md" responsiveFullWidth onClick={onClose}>
                Got it
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* MVP copy — short, accurate, no lawyerese. Swap when legal signs off. */
/* ------------------------------------------------------------------ */

type Doc = {
  eyebrow: string;
  title: string;
  updated: string;
  sections: { heading: string; paragraphs: string[] }[];
};

const CONTENT: Record<LegalKind, Doc> = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'How we handle your data',
    updated: 'May 2026',
    sections: [
      {
        heading: 'Nothing leaves your device',
        paragraphs: [
          'Everything you enter — quiz answers, uploaded lab reports, the markers we extract — stays in your browser. There is no server, no cloud sync, and no telemetry. We do not have a database of users because we do not run one.',
          'The parser (PDF text + OCR) runs entirely in your browser using WebAssembly. Your lab reports are never uploaded anywhere.',
        ],
      },
      {
        heading: 'What we store, and where',
        paragraphs: [
          'Quiz answers, uploaded report metadata, extracted biomarker values, and the anonymous local ID that identifies your session — all kept in your browser\'s localStorage under keys prefixed dc_*.',
          'Because storage is per-browser-per-device, your data does not sync across phones, laptops, or browsers. Clearing your browser data (or using private/incognito mode) will wipe it.',
        ],
      },
      {
        heading: 'What this protects against (and what it doesn\'t)',
        paragraphs: [
          'Because there is no server, there is nothing for us — or anyone breaching us — to leak. We cannot sell, share, or accidentally expose data we never received.',
          'However: anyone with access to your unlocked device can open the app and read your data, and any browser extension you have installed can read localStorage on this site. We do not encrypt the values. Use this product on a device you trust.',
        ],
      },
      {
        heading: 'Deletion',
        paragraphs: [
          'Profile › My data & exports clears every dc_* key from your browser in one tap. There is nothing for us to delete on our end — see above.',
        ],
      },
      {
        heading: 'Questions',
        paragraphs: [
          'Write to hello@formen.co.in. We reply within 7 business days.',
        ],
      },
    ],
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Terms of use',
    updated: 'May 2026',
    sections: [
      {
        heading: 'What this product is',
        paragraphs: [
          'Digital Clinic translates and contextualises your lab reports. It groups markers by pathway, flags numbers outside the healthy range, and tracks how they change over time.',
        ],
      },
      {
        heading: 'What this product is not',
        paragraphs: [
          'This is not a diagnosis. It is not medical advice. Always discuss findings with a qualified doctor before changing medication, starting therapy, or making major lifestyle decisions on the basis of any reading.',
        ],
      },
      {
        heading: 'Use at your own risk',
        paragraphs: [
          'The service is provided "as-is" without warranty of any kind. We do our best to keep marker ranges current with published clinical guidelines, but we cannot guarantee the absence of errors. Use your judgement.',
        ],
      },
      {
        heading: 'Your account',
        paragraphs: [
          'You may stop using the product at any time. We may suspend service for misuse — uploading reports that are not yours, attempting to compromise the platform, or violating applicable laws.',
        ],
      },
    ],
  },
  about: {
    eyebrow: 'About',
    title: 'Why we built this',
    updated: 'May 2026',
    sections: [
      {
        heading: 'Men, hormones, India',
        paragraphs: [
          '29% of Indian men over 40 have an undiagnosed hormonal deficiency. 2.2% have heard of andropause. There is no consumer-grade product that takes a man\'s blood report and tells him what it actually means.',
          'Digital Clinic is that product. Built on HPG-axis endocrinology, focused on Indian male physiology, and designed to be the bridge between "I got my bloods done" and "I know what to do about them".',
        ],
      },
      {
        heading: 'The team',
        paragraphs: [
          'A small group of clinicians, engineers, and designers working out of Bengaluru. We are a pre-seed startup and we read every email.',
        ],
      },
    ],
  },
  contact: {
    eyebrow: 'Contact',
    title: 'Get in touch',
    updated: 'May 2026',
    sections: [
      {
        heading: 'General + product',
        paragraphs: [
          'hello@formen.co.in — questions, feedback, partnership requests. We reply within two working days.',
        ],
      },
      {
        heading: 'Privacy + data requests',
        paragraphs: [
          'privacy@formen.co.in — deletion requests, data exports, anything covered in our Privacy section.',
        ],
      },
      {
        heading: 'Press + medical advisors',
        paragraphs: [
          'team@formen.co.in — clinical reviewers, advisors, or anyone writing about men\'s hormonal health in India.',
        ],
      },
    ],
  },
};
