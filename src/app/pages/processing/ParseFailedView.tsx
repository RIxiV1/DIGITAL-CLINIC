import { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Pencil,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Container from '../../components/Container';
import Logo from '../../components/Logo';
import type { FailureState } from './types';

/* ================================================================== */
/* Inline error state — parser yielded zero usable markers              */
/* ================================================================== */

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
  const copy = (() => {
    switch (failure.reason) {
      case 'parser-error':
        return {
          title: 'We couldn’t open this file.',
          detail:
            failure.errorMessage ??
            'The file may be corrupted, password-protected, or in an unexpected format.',
        };
      case 'no-file':
        return {
          title: 'There was nothing to parse.',
          detail:
            'It looks like the upload didn’t carry through — try uploading the file again from the Upload page.',
        };
      case 'out-of-scope':
        // Exact string. Keep it intact — backend / analytics / future
        // automated handlers should be able to string-match on it.
        return {
          title: 'This report is outside what we cover.',
          detail:
            'Error: The uploaded document contains testing (e.g., infectious disease panels or localized physical exams) that is not related to general metabolic biomarkers or the HPA axis ecosystem. We cannot analyze this report.',
        };
      case 'no-matches':
      default:
        return {
          title: 'We read the file, but didn’t recognise any lab values.',
          detail:
            'Either the report’s layout is outside what our parser supports yet, or the file is something other than a lab report. We deliberately don’t make up values to fill in — you’d see numbers that weren’t in your report.',
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
          <div
            role="alert"
            aria-live="assertive"
            className="p-6 border-b border-concern/20 bg-concern-soft/60"
          >
            <div className="flex items-start gap-3">
              <div className="grid place-items-center w-11 h-11 rounded-2xl bg-concern/15 text-concern shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-micro font-bold uppercase tracking-eyebrow text-concern">
                  Parsing failed
                </div>
                <h1 className="font-display text-display-md leading-tight text-ink mt-1">
                  {copy.title}
                </h1>
                <p className="mt-2 text-caption leading-relaxed text-ink-soft">
                  {copy.detail}
                </p>
                <div className="mt-3 rounded-[10px] bg-surface border border-line/70 px-3 py-2 text-caption text-muted break-all">
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
                    <div className="mt-3 rounded-[10px] bg-attention-soft/60 border border-attention/30 px-3 py-2 text-caption text-ink-soft">
                      <span className="font-bold uppercase tracking-label text-micro text-attention block mb-0.5">
                        Partial OCR
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
            </div>
          </div>

          <div className="p-5 grid gap-2.5">
            {/* Vision-LLM fallback button. Surfaces only when the
                failed upload was an image and we still have the
                original bytes (the no-file refresh case skips this).
                Sits above "Enter values manually" because for the user
                whose photo just failed Tesseract, the AI parser is
                meaningfully more likely to succeed than typing 20 lab
                values by hand. Gold tone signals "try this first" the
                same way the Starter Check uses gold to mark "do this
                first" on the recommended-tests page.
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
                  className="!bg-gold-500 !text-indigo-900 hover:!bg-gold-400"
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
            <div className="grid sm:grid-cols-2 gap-2.5">
              <Button
                size="md"
                variant="secondary"
                leading={<RotateCcw size={14} />}
                onClick={onRetry}
                fullWidth
              >
                Try a different file
              </Button>
              <Button
                size="md"
                variant="secondary"
                leading={<Sparkles size={14} />}
                onClick={onSample}
                fullWidth
              >
                Use sample report
              </Button>
            </div>
          </div>

          <div className="px-5 pb-5 -mt-1">
            <p className="text-caption text-muted leading-relaxed">
              {failure.reason === 'out-of-scope'
                ? 'Your file looks like a viral panel, imaging report, or clinical exam — those aren’t something we interpret. If part of it has metabolic, hormone, or vitamin values, type them in via “Enter values manually”.'
                : 'Our parser currently recognises hormone, metabolic, heart, thyroid, vitamin, liver, kidney, blood, electrolyte, inflammation, and fertility markers from text-layer PDFs and clear photos. Older scanned PDFs or non-standard lab layouts may not parse — we don’t guess.'}
            </p>
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
