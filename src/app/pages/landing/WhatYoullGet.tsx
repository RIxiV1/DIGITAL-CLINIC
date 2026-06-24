import { Download, Lock, Microscope } from 'lucide-react';
import Logo from '../../components/Logo';
import { Reveal, SectionHeader } from './shared';

// What you actually walk away with — re-cut from the old lucide icon-card
// checklist (the stock generated-feature-list block) into a hairline mono
// manifest, the same editorial voice as the HowItWorks axis and the
// Credibility verification ledger. No icon squares, no card shadows: a
// numbered list on hairlines, mono indices in the decorative clay accent.
const DELIVERABLES = [
  {
    n: '01',
    title: 'Which hormones to test — and why',
    body: 'A panel matched to you, not the generic "men’s wellness" combo every lab pushes.',
  },
  {
    n: '02',
    title: 'What each result means for you',
    body: 'Your numbers in plain words, with your symptoms connected to the markers.',
  },
  {
    n: '03',
    title: 'Which specialist to see — and what to ask',
    body: 'Endocrinologist, urologist or GP? The right person, and the right questions.',
  },
  {
    n: '04',
    title: 'Trend tracking when you retest',
    body: 'See whether what you’re doing is actually moving the needle.',
  },
  {
    n: '05',
    title: 'A one-page Doctor Summary to print',
    body: 'A clean PDF you can hand to any clinician at any appointment.',
  },
  {
    n: '06',
    title: 'Your data, always yours',
    body: 'Download or share it any time. Stored under your anonymous ID, on your device.',
  },
];

export default function WhatYoullGet() {
  return (
    <section
      id="report"
      className="py-16 sm:py-20 md:py-28 bg-blue-50/40 border-y border-line/70"
    >
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="What you’ll get"
            title="Reports you can actually understand."
            subtitle="No more Googling confusing medical terms. We break down your recommended tests and results into plain language."
          />
        </Reveal>

        <div className="mt-10 md:mt-14 grid md:grid-cols-12 gap-8 md:gap-12 items-center">
          {/* LEFT — Doctor Summary mockup */}
          <div className="md:col-span-7 order-2 md:order-1">
            <Reveal>
              <DoctorSummaryMockup />
            </Reveal>
          </div>

          {/* RIGHT — Deliverables manifest (hairline mono, not icon cards) */}
          <div className="md:col-span-5 order-1 md:order-2">
            <Reveal>
              <div className="border-t border-line">
                {DELIVERABLES.map(({ n, title, body }) => (
                  <div
                    key={n}
                    className="grid grid-cols-[auto_1fr] gap-x-4 sm:gap-x-5 py-4 border-b border-line"
                  >
                    <span className="font-mono text-caption font-bold text-clay tabular-nums leading-none pt-0.5">
                      {n}
                    </span>
                    <div>
                      <div className="font-semibold text-ink text-body-sm leading-snug">
                        {title}
                      </div>
                      <div className="text-caption text-ink-soft leading-relaxed mt-1">
                        {body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function DoctorSummaryMockup() {
  return (
    <div className="relative">
      <div className="relative rounded-2xl bg-surface border border-line shadow-clinical-lg overflow-hidden">
        {/* Header — Doctor Summary */}
        <div className="px-5 md:px-6 py-4 border-b border-line bg-blue-50/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo size="sm" />
            </div>
            <div className="text-micro uppercase tracking-label font-bold text-blue-700">
              Doctor Summary · v1
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <div className="font-sans font-bold text-display-md tracking-tight">
              Hormonal Health Snapshot
            </div>
            <div className="text-caption text-muted">Patient: FM-A284</div>
          </div>
          <div className="mt-1 text-caption text-muted">
            For: Endocrinologist · 12 Apr 2026 · 1 page
          </div>
        </div>

        {/* Body */}
        <div className="p-5 md:p-6 grid md:grid-cols-5 gap-5">
          {/* Left — Top-line read */}
          <div className="md:col-span-2 space-y-4">
            <div className="rounded-2xl bg-clay text-on-clay p-5 relative overflow-hidden">
              <div className="relative">
                <div className="text-micro font-bold uppercase tracking-label text-on-clay/85">
                  Top-line read
                </div>
                <p className="mt-2 font-sans font-semibold text-body leading-snug">
                  Two hormone markers flagged — low free testosterone and
                  vitamin D. Likely connected to fatigue + low libido on intake.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-surface border border-line p-4">
              <div className="text-micro font-bold uppercase tracking-label text-blue-700">
                Specialist
              </div>
              <div className="mt-2 flex items-start gap-2">
                <Microscope
                  size={14}
                  className="text-ink-soft mt-0.5 shrink-0"
                />
                <div>
                  <div className="text-caption font-semibold text-ink">
                    Endocrinologist
                  </div>
                  <div className="text-caption text-ink-soft leading-snug mt-0.5">
                    Bring this page. Ask about retest in 8 weeks.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Recommended tests with The Why */}
          <div className="md:col-span-3">
            <div className="rounded-2xl bg-surface border border-line p-4 md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-micro font-bold uppercase tracking-label text-blue-700">
                    Recommended tests
                  </div>
                  <div className="font-sans font-semibold text-body-sm mt-1">
                    4 panels — ranked by impact
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2.5">
                <TestRow
                  index="01"
                  name="Hormonal Panel — Total + Free Testosterone, SHBG, LH"
                  reason="Low libido + fatigue + thinning hair pattern."
                  flag="High"
                />
                <TestRow
                  index="02"
                  name="Vitamin D (25-OH) + B12"
                  reason="Energy and mood symptoms; deficiency common in India."
                  flag="High"
                />
                <TestRow
                  index="03"
                  name="Thyroid (TSH · T3 · T4)"
                  reason="Rule out thyroid contribution to fatigue + weight."
                  flag="Med"
                />
                <TestRow
                  index="04"
                  name="HbA1c + Fasting Insulin"
                  reason="Belly fat pattern — check insulin response early."
                  flag="Med"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer ribbon */}
        <div className="px-5 md:px-6 py-3 border-t border-line bg-blue-50/40 flex flex-wrap items-center justify-between gap-3 text-caption text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <Lock size={12} className="text-blue-600" />
            FM-A284 · Anonymous ID
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Download size={12} className="text-blue-600" />
            Print or save as PDF
          </span>
        </div>
      </div>
    </div>
  );
}

function TestRow({
  index,
  name,
  reason,
  flag,
}: {
  index: string;
  name: string;
  reason: string;
  flag: 'High' | 'Med' | 'Low';
}) {
  const flagTone =
    flag === 'High'
      ? 'bg-concern-soft text-concern border-concern-soft'
      : flag === 'Med'
        ? 'bg-attention-soft text-attention border-attention-soft'
        : 'bg-blue-50 text-blue-700 border-blue-100';
  return (
    <div className="rounded-xl border border-line bg-canvas/40 p-3 flex items-start gap-3">
      <span className="grid place-items-center shrink-0 w-7 h-7 rounded-lg bg-surface border border-blue-100 text-blue-700 font-mono text-micro font-bold">
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="font-sans font-semibold text-caption text-ink leading-snug">
            {name}
          </span>
          <span
            className={`text-micro font-bold uppercase tracking-widest px-1.5 h-4 rounded-full border inline-flex items-center shrink-0 ${flagTone}`}
          >
            {flag}
          </span>
        </div>
        <div className="mt-1 flex items-start gap-1.5">
          <span className="text-micro font-bold uppercase tracking-widest text-blue-700 mt-0.5 shrink-0">
            Why
          </span>
          <span className="text-caption text-ink-soft leading-snug">
            {reason}
          </span>
        </div>
      </div>
    </div>
  );
}
