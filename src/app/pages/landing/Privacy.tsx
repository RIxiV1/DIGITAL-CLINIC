import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Lock, ShieldCheck, UserX } from 'lucide-react';
import { Reveal, SectionHeader } from './shared';

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
  return (
    <section
      id="privacy"
      className="py-16 sm:py-20 md:py-28 bg-canvas border-t border-line/60"
    >
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="Your privacy"
            title={
              <>
                Your report never{' '}
                <span className="text-blue-700">leaves your device.</span>
              </>
            }
            subtitle="No account to create, no file to upload to us. The whole thing runs in your browser — because a lab report is nobody else's business."
          />
        </Reveal>

        <div className="mt-12 md:mt-16 grid md:grid-cols-3 gap-5">
          <Reveal>
            <PromiseCard
              icon={<Cpu size={22} strokeWidth={2.2} />}
              title="Parsed on your device"
              body="Your PDF or photo is read right here in this browser — the numbers are extracted on your phone, not on a server. The file never gets uploaded to us."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <PromiseCard
              icon={<UserX size={22} strokeWidth={2.2} />}
              title="No account, ever"
              body="No email, no password, no sign-up wall. You're anonymous from the first tap. There's no profile of you sitting in a database somewhere."
            />
          </Reveal>
          <Reveal delay={0.16}>
            <PromiseCard
              icon={<Lock size={22} strokeWidth={2.2} />}
              title="You hold the data"
              body="Results are stored only on this device, in this browser. Clear them whenever you like — there's nothing on our end to delete, because we never had it."
            />
          </Reveal>
        </div>

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

function PromiseCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="h-full rounded-2xl p-7 md:p-8 bg-surface border border-line shadow-clinical"
    >
      <div className="grid place-items-center w-12 h-12 rounded-2xl bg-blue-50 text-blue-700">
        {icon}
      </div>
      <h3 className="mt-5 font-sans font-bold text-body-lg leading-snug text-ink">
        {title}
      </h3>
      <p className="mt-3 text-body-sm text-ink-soft leading-relaxed text-pretty">
        {body}
      </p>
    </motion.div>
  );
}
