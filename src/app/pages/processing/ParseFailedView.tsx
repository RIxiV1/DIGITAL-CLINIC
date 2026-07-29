import { useState } from 'react';
import {
  Check,
  ChevronDown,
  FileText,
  Pencil,
  RotateCcw,
  ScanLine,
  Sparkles,
  Target,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ClinicalSpot, {
  type ClinicalSpotName,
} from '../../components/ClinicalSpot';
import Container from '../../components/ui/Container';
import Logo from '../../components/ui/Logo';
import type { FailureState } from './types';

/* ================================================================== */
/* Inline error state — parser yielded zero usable markers              */
/* ================================================================== */

/** The marker families the parser interprets — rendered as scannable chips
 *  on the no-matches state instead of a run-on sentence, so a user can see
 *  at a glance what IS covered. Mirrors the biomarkerCatalog categories. */
const PARSER_CATEGORIES = [
  'Hormone',
  'Metabolic',
  'Heart',
  'Thyroid',
  'Vitamin',
  'Liver',
  'Kidney',
  'Blood',
  'Electrolyte',
  'Inflammation',
  'Fertility',
] as const;

/**
 * "Here's what happened" process strip. Shown on the states where we DID read
 * the file but couldn't line it up (no-matches / not-lab-content / out-of-
 * scope). The first two steps are done (accent + check), the last is the one
 * that didn't complete (dashed, muted) — so the failure reads as "we got your
 * file and read every line; the matching is what stopped," not "your file is
 * broken." Same objects-not-people, ink-line vocabulary as ClinicalSpot;
 * lucide glyphs keep it consistent with the rest of the app's iconography.
 */
function ProcessStrip({ lastLabel }: { lastLabel: string }) {
  const steps = [
    { icon: FileText, label: 'Uploaded', done: true },
    { icon: ScanLine, label: 'Read every line', done: true },
    { icon: Target, label: lastLabel, done: false },
  ];
  // 3 equal columns so each node sits at its column's centre and every label
  // lands directly beneath its node — no magic offsets to drift. The connector
  // is absolute from a node's centre spanning one full column (= the exact gap
  // to the next node's centre). The accent PATH runs through the completed
  // steps and turns to a dashed muted line into the step that didn't complete
  // — the failure reads as "we got here, this is where it stopped".
  const NODE = 44; // h-11
  return (
    <div className="mt-7 w-full max-w-[20rem] mx-auto grid grid-cols-3">
      {steps.map((s, i) => {
        const nextDone = i < steps.length - 1 && steps[i + 1].done;
        return (
          <div key={s.label} className="relative flex flex-col items-center gap-2">
            {i < steps.length - 1 && (
              <div
                aria-hidden
                style={{ top: NODE / 2 }}
                className={`absolute left-1/2 w-full h-px ${
                  nextDone
                    ? 'bg-forest/45'
                    : 'border-t border-dashed border-line-strong'
                }`}
              />
            )}
            <div
              className={`relative z-10 grid place-items-center w-11 h-11 rounded-full ${
                s.done
                  ? 'bg-forest/12 text-forest border border-forest/40'
                  : 'bg-surface text-muted border border-dashed border-line-strong'
              }`}
            >
              <s.icon size={17} aria-hidden />
              {s.done && (
                <span className="absolute -top-1 -right-1 grid place-items-center w-[18px] h-[18px] rounded-full bg-forest text-on-forest ring-2 ring-surface">
                  <Check size={11} strokeWidth={3} aria-hidden />
                </span>
              )}
            </div>
            <span
              className={`text-micro leading-tight text-center px-0.5 ${
                s.done ? 'text-ink-soft' : 'text-ink font-semibold'
              }`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ParseFailedView({
  failure,
  onRetry,
  onSample,
  onManualEntry,
  onTryAi,
}: {
  failure: FailureState;
  onRetry: () => void;
  onSample: () => void;
  onManualEntry: () => void;
  /** Pipeline 3 escape hatch: send the original File to /api/parse-image
   *  (Gemini Vision) and let the LLM extract markers our local parsers
   *  couldn't. Returns `{ error }` on any failure (network, 0 markers
   *  recognised, schema mismatch) so this view can surface the message
   *  inline without taking over the page. On success the parent
   *  transitions to ConfirmExtractedValuesView; this view unmounts. */
  onTryAi: (file: File) => Promise<{ error?: string }>;
}) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // The AI parser is only useful when we still have the original File
  // (the no-file refresh path leaves failure.file undefined) AND the
  // file is something Gemini can read directly. We're capable of
  // sending PDFs too eventually, but the current path only wires up
  // image MIME types — rendering PDF pages to canvas before upload
  // is a follow-up.
  const aiAvailable =
    !!failure.file && /^image\//.test(failure.file.type || '');

  const handleAiClick = async () => {
    if (!failure.file) return;
    setAiBusy(true);
    setAiError(null);
    const result = await onTryAi(failure.file);
    // If the parser succeeded the parent already transitioned to the
    // confirm view and this component is about to unmount — we still
    // clear local state so a remount renders cleanly.
    setAiBusy(false);
    if (result.error) setAiError(result.error);
  };
  // Reason-specific headline so the user knows what actually happened.
  // - parser-error: pdfjs/tesseract threw (corrupt PDF, locked PDF, …)
  // - no-file: pendingUpload was empty (refresh mid-flow, deep-link)
  // - out-of-scope: parsed fine but the document type isn't a lab panel
  //   (viral panel, imaging report, dental exam, ECG). Distinct copy
  //   so the user understands the parser isn't broken, the report
  //   is just outside what the product supports.
  // - no-matches: catch-all for "we read it but found nothing useful"
  //   when the out-of-scope classifier isn't confident.
  const copy: {
    kicker: string;
    title: string;
    detail: string;
    spot: ClinicalSpotName;
  } = (() => {
    switch (failure.reason) {
      case 'parser-error':
        return {
          kicker: 'Nothing was lost',
          title: 'We couldn’t open this file.',
          detail:
            failure.errorMessage ??
            'The file may be corrupted, password-protected, or in an unexpected format. Your report is safe on your device — nothing was sent anywhere.',
          spot: 'damaged',
        };
      case 'no-file':
        // "no-file" can mean the upload was genuinely empty (refresh mid-
        // flow) OR the file's bytes were lost after a document that had no
        // readable results — so we can't assume "re-upload fixes it". Be
        // honest about both, and say plainly what we DON'T read.
        return {
          kicker: 'Let’s try that again',
          title: 'We couldn’t read any results from this.',
          detail:
            'Two things cause this: the upload didn’t finish, or the file isn’t a blood test with values. We read lab results — a marker, a number and a unit, like “Testosterone 280 ng/dL”. Screening checklists, appointment schedules, and imaging aren’t something we parse. Try uploading again, or a different file.',
          spot: 'blank',
        };
      case 'out-of-scope':
        return {
          kicker: 'A different kind of report',
          title: 'This looks like a different kind of report.',
          detail:
            'We read blood-test results — a marker, a number and a unit, like “Testosterone 280 ng/dL”. This looks like something else: an infectious-disease panel, an imaging or urine report, a physical exam, or a food / product-safety certificate. Nothing’s wrong with your file — it’s just not what we interpret. If part of it has blood values, you can type those in below.',
          spot: 'off-scope',
        };
      case 'blank':
        // Nothing readable came out — a blank page, or a scan/photo too
        // dark, blurry, or low-resolution for the text to be read.
        return {
          kicker: 'Nothing to read',
          title: 'This looks blank.',
          detail:
            'We couldn’t read anything from this file. If it’s a photo, it may be too dark, blurry, or low-resolution — a clear, well-lit shot of the whole page usually fixes it. If it’s a PDF, it may be a scan with no text layer.',
          spot: 'blank',
        };
      case 'not-lab-content':
        // We read text but found no lab-value rows — a photo, a screenshot,
        // or a document, not a blood test. Say that plainly and warmly;
        // never make the user feel they did it wrong.
        return {
          kicker: 'This one isn’t a lab report',
          title: 'We read this, but it isn’t a blood test.',
          detail:
            'We could read the text, but there were no lab values in it — a blood test is a marker, a number and a unit, like “Testosterone 280 ng/dL.” This looks more like a photo, a screenshot, or a document. Upload a lab report as a PDF or a clear photo, or enter values manually.',
          spot: 'searching',
        };
      case 'no-matches':
      default:
        return {
          kicker: 'We read every line',
          title: 'We found values, but couldn’t match them to markers.',
          detail:
            'We read some numbers, but none lined up with the markers we recognise — so it’s likely a lab layout we don’t support yet. We deliberately don’t guess: better to say we couldn’t read it than to show you a value that wasn’t in your report.',
          spot: 'searching',
        };
    }
  })();

  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      <Container size="narrow" className="pt-6">
        <Logo />
      </Container>

      <Container
        size="narrow"
        className="flex-1 flex flex-col items-center justify-center pb-16"
      >
        <Card padded={false} className="w-full overflow-hidden">
          {/* Calm, illustrated error head. The spot illustration reads
              the state BEFORE the headline does; the tint is warm paper,
              not alarm-red, because most failures here are "this file
              isn't a lab report" — not an emergency. The reassuring
              kicker ("Nothing was lost") lands first. role=alert +
              aria-live=polite keeps it announced without shouting. */}
          <div
            role="alert"
            aria-live="polite"
            className="px-6 pt-10 pb-8 sm:px-8 border-b border-line/70 bg-gradient-to-b from-canvas/60 to-transparent flex flex-col items-center text-center"
          >
            <ClinicalSpot name={copy.spot} size={152} className="mb-5" />
            <div className="text-micro font-bold uppercase tracking-eyebrow text-gold-700">
              {copy.kicker}
            </div>
            <h1 className="font-display text-display-md leading-tight text-ink mt-2 text-balance">
              {copy.title}
            </h1>
            <p className="mt-2 text-caption leading-relaxed text-ink-soft max-w-md">
              {copy.detail}
            </p>
            {/* "Here's what happened" strip — only on the states where we read
                the file but couldn't map it, so the story is honest. */}
            {(failure.reason === 'no-matches' ||
              failure.reason === 'not-lab-content' ||
              failure.reason === 'out-of-scope') && (
              <ProcessStrip
                lastLabel={
                  failure.reason === 'out-of-scope'
                    ? 'Different report'
                    : failure.reason === 'not-lab-content'
                      ? 'No lab values'
                      : 'No markers matched'
                }
              />
            )}
            <div className="mt-4 inline-block text-left rounded-[10px] bg-surface border border-line/70 px-3 py-2 text-caption text-muted break-all max-w-full">
              <span className="font-bold uppercase tracking-label text-micro text-muted block mb-0.5">
                File
              </span>
              {failure.fileName}
            </div>
            {/* OCR partial-failure callout. Without this, a user
                whose 3-page PDF had 2 pages time out reads "we
                didn't recognise any lab values" and blames their
                report — when actually the parser only saw 1/3 of
                it. Calling it out turns blame into "try again /
                upload pages individually". */}
            {failure.ocrPagesAttempted &&
              failure.ocrPagesSkipped !== undefined &&
              failure.ocrPagesSkipped > 0 && (
                <div className="mt-3 text-left rounded-[10px] bg-attention-soft/60 border border-attention/30 px-3 py-2 text-caption text-ink-soft max-w-md">
                  <span className="font-bold uppercase tracking-label text-micro text-attention block mb-0.5">
                    Partial read
                  </span>
                  {failure.ocrPagesSkipped} of {failure.ocrPagesAttempted}{' '}
                  page{failure.ocrPagesAttempted === 1 ? '' : 's'} timed out
                  before we could read{' '}
                  {failure.ocrPagesAttempted === 1 ? 'it' : 'them'}. The
                  remaining page
                  {failure.ocrPagesAttempted - failure.ocrPagesSkipped === 1
                    ? ''
                    : 's'}{' '}
                  may not have had the values you were expecting. Retrying —
                  or cropping the relevant section into a clearer photo —
                  usually helps.
                </div>
              )}
          </div>

          <div className="p-5 grid gap-2.5">
            {/* Vision-LLM fallback button. Surfaces only when the
                failed upload was an image and we still have the
                original bytes (the no-file refresh case skips this).
                Sits above "Enter values manually" because for the user
                whose photo just failed Tesseract, the AI parser is
                meaningfully more likely to succeed than typing 20 lab
                values by hand. It uses the calm forest primary (the app's
                single CTA accent) — its "try this first" weight comes from
                being the top, full-width action, not a loud gold fill (the
                bright override read as jarring on the dark card).
                Privacy disclosure under the button is non-negotiable:
                Pipelines 1+2 never leave the device; Pipeline 3 sends
                the image to Google AI Studio's free tier, which may
                retain it for service improvement. The user opts in
                deliberately. When we swap to a paid Vertex AI key
                later, the no-retention guarantee kicks in and the
                disclosure can soften. */}
            {aiAvailable && (
              <>
                <Button
                  size="md"
                  variant="primary"
                  leading={<Sparkles size={14} />}
                  onClick={handleAiClick}
                  disabled={aiBusy}
                  fullWidth
                >
                  {aiBusy ? 'Reading with AI…' : 'Try AI parser'}
                </Button>
                <p className="text-micro text-muted leading-relaxed -mt-1.5 px-1">
                  Sends this image to Google Gemini for parsing. The image
                  leaves your device for this step; Google may retain it to
                  improve their service. Free, no account needed.
                </p>
                {aiError && (
                  <div
                    role="alert"
                    className="rounded-[10px] bg-concern-soft/60 border border-concern/30 px-3 py-2 text-caption text-ink-soft"
                  >
                    <span className="font-bold uppercase tracking-label text-micro text-concern block mb-0.5">
                      AI parser
                    </span>
                    {aiError}
                  </div>
                )}
              </>
            )}
            <Button
              size="md"
              variant={aiAvailable ? 'secondary' : 'primary'}
              leading={<Pencil size={14} />}
              onClick={onManualEntry}
              fullWidth
            >
              Enter values manually
            </Button>
            {/* Tertiary escape hatches — deliberately quiet (ghost, no
                fill/border) so the eye lands on the primary + manual entry
                first. A row of solid buttons made the block feel like a
                heavy 4-button stack. */}
            <div className="mt-0.5 flex items-center justify-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                leading={<RotateCcw size={14} />}
                onClick={onRetry}
              >
                Different file
              </Button>
              <span className="text-muted/50" aria-hidden>
                ·
              </span>
              <Button
                size="sm"
                variant="ghost"
                leading={<Sparkles size={14} />}
                onClick={onSample}
              >
                Sample report
              </Button>
            </div>
          </div>

          <div className="px-5 pb-5 -mt-1">
            {failure.reason === 'out-of-scope' ? (
              <p className="text-caption text-muted leading-relaxed">
                This looks like a viral panel, imaging or ECG, a urine test, a
                physical exam, or a food / product-safety certificate — not a
                blood test. If part of it does have blood values, add them with
                “Enter values manually”.
              </p>
            ) : (
              // De-boxed + de-pilled: the panel-in-a-card and 11 outlined
              // chips read as busy. A quiet middot line of the families is
              // calmer and still scannable.
              <div className="text-center">
                <p className="text-micro font-bold uppercase tracking-label text-muted mb-1.5">
                  What we read
                </p>
                <p className="text-caption text-ink-soft leading-relaxed max-w-sm mx-auto">
                  {PARSER_CATEGORIES.join(' · ')}
                </p>
                <p className="mt-2 text-caption text-muted leading-relaxed max-w-sm mx-auto">
                  …from text-layer PDFs and clear photos. Older scans or
                  non-standard layouts may not parse — we don’t guess.
                </p>
              </div>
            )}
          </div>

          {/* Raw-text diagnostic. Same disclosure pattern the confirm
              view uses on success — on failure it's even more useful
              because the user (and us) can see WHY the catalog matcher
              found nothing. If the marker names + values are in the
              text but the matcher missed them, the matcher's the bug.
              If the text is empty or garbled, OCR/text-layer
              extraction is the bug. Without this disclosure every
              failure was a black box. */}
          {failure.rawText && (
            <details className="group border-t border-line/70">
              <summary className="cursor-pointer list-none px-5 py-3 flex items-center gap-1.5 text-caption font-bold uppercase tracking-label text-muted hover:text-ink hover:bg-canvas/40 transition-colors">
                <ChevronDown
                  size={12}
                  className="transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
                Show what we read from the file
              </summary>
              <pre className="px-5 pb-5 text-caption text-ink-soft leading-relaxed whitespace-pre-wrap font-mono break-words max-h-[320px] overflow-y-auto">
                {failure.rawText.slice(0, 8000)}
                {failure.rawText.length > 8000 && '\n…(truncated)'}
              </pre>
            </details>
          )}
        </Card>
      </Container>
    </div>
  );
}
