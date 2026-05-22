import {
  BookOpen,
  Download,
  FileText,
  FlaskConical,
  Lock,
  Microscope,
  TrendingUp,
} from 'lucide-react';
import Logo from '../../components/Logo';
import { Reveal, SectionHeader } from './shared';

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

        <div className="mt-10 md:mt-14 grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* LEFT — Doctor Summary mockup */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <Reveal>
              <DoctorSummaryMockup />
            </Reveal>
          </div>

          {/* RIGHT — Checklist */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <Reveal>
              <div className="grid gap-3">
                {[
                  {
                    Icon: FlaskConical,
                    title: 'Which hormones to test — and why',
                    body: 'Personalised panel. Not the generic "men’s wellness" combo every lab pushes.',
                  },
                  {
                    Icon: BookOpen,
                    title: 'What each result means for you specifically',
                    body: 'Your numbers, translated. Your symptoms, connected to the markers.',
                  },
                  {
                    Icon: Microscope,
                    title: 'Which specialist to see (and what to ask them)',
                    body: 'Endocrinologist, urologist, GP? The right person, the right questions.',
                  },
                  {
                    Icon: TrendingUp,
                    title: 'Trend tracking when you retest',
                    body: 'See whether what you’re doing is actually moving the needle.',
                  },
                  {
                    Icon: FileText,
                    title: 'A Doctor Summary you can print',
                    body: 'A clean one-page PDF you can hand to any clinician at any appointment.',
                  },
                ].map(({ Icon, title, body }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 rounded-2xl bg-white border border-line p-4 shadow-clinical"
                  >
                    <div className="grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                      <Icon size={17} />
                    </div>
                    <div>
                      <div className="font-semibold text-ink text-[14.5px]">
                        {title}
                      </div>
                      <div className="text-[13px] text-ink-soft leading-relaxed mt-0.5">
                        {body}
                      </div>
                    </div>
                  </div>
                ))}

                {/* PDF folded in as sub-feature. Inline "See a sample
                    report" CTA removed — TopNav + Hero already carry
                    that affordance, having a third on the same page
                    diluted both. */}
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white border border-blue-100 p-4 shadow-clinical">
                  <div className="grid place-items-center w-10 h-10 rounded-xl bg-blue-600 text-white shrink-0">
                    <Download size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink text-[14px]">
                      Your health data, always accessible
                    </div>
                    <div className="text-[12.5px] text-ink-soft mt-0.5">
                      Download as PDF. Share with any doctor. Stored under your
                      anonymous ID.
                    </div>
                  </div>
                </div>
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
      <div className="absolute -inset-2 rounded-[24px] bg-gradient-to-br from-blue-100/70 via-white to-blue-50 blur-2xl opacity-60 pointer-events-none" />

      <div className="relative rounded-2xl bg-white border border-line shadow-clinical-lg overflow-hidden">
        {/* Header — Doctor Summary */}
        <div className="px-5 md:px-6 py-4 border-b border-line bg-blue-50/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo size="sm" />
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-blue-700">
              Doctor Summary · v1
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <div className="font-sans font-bold text-[20px] tracking-[-0.01em]">
              Hormonal Health Snapshot
            </div>
            <div className="text-[11px] text-muted">Patient: FM-A284</div>
          </div>
          <div className="mt-1 text-[11.5px] text-muted">
            For: Endocrinologist · 12 Apr 2026 · 1 page
          </div>
        </div>

        {/* Body */}
        <div className="p-5 md:p-6 grid md:grid-cols-5 gap-5">
          {/* Left — Top-line read */}
          <div className="md:col-span-2 space-y-4">
            <div className="rounded-2xl bg-blue-600 text-white p-5 shadow-clinical relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-blue-400/30 blur-2xl" />
              <div className="relative">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">
                  Top-line read
                </div>
                <p className="mt-2 font-sans font-semibold text-[15px] leading-snug">
                  Two hormone markers flagged — low free testosterone and
                  vitamin D. Likely connected to fatigue + low libido on
                  intake.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-line p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
                Specialist
              </div>
              <div className="mt-2 flex items-start gap-2">
                <Microscope size={14} className="text-ink-soft mt-0.5 shrink-0" />
                <div>
                  <div className="text-[13px] font-semibold text-ink">
                    Endocrinologist
                  </div>
                  <div className="text-[11.5px] text-ink-soft leading-snug mt-0.5">
                    Bring this page. Ask about retest in 8 weeks.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Recommended tests with The Why */}
          <div className="md:col-span-3">
            <div className="rounded-2xl bg-white border border-line p-4 md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
                    Recommended tests
                  </div>
                  <div className="font-sans font-semibold text-[14.5px] mt-1">
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
        <div className="px-5 md:px-6 py-3 border-t border-line bg-blue-50/40 flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-soft">
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
      <span className="grid place-items-center shrink-0 w-7 h-7 rounded-lg bg-white border border-blue-100 text-blue-700 font-mono text-[10px] font-bold">
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="font-sans font-semibold text-[13px] text-ink leading-snug">
            {name}
          </span>
          <span
            className={`text-[9.5px] font-bold uppercase tracking-[0.1em] px-1.5 h-4 rounded-full border inline-flex items-center shrink-0 ${flagTone}`}
          >
            {flag}
          </span>
        </div>
        <div className="mt-1 flex items-start gap-1.5">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-blue-700 mt-0.5 shrink-0">
            Why
          </span>
          <span className="text-[12px] text-ink-soft leading-snug">
            {reason}
          </span>
        </div>
      </div>
    </div>
  );
}
