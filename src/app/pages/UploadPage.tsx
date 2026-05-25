import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Info,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import StickyBottomBar from '../components/StickyBottomBar';
import { useNavigation, useReports } from '../AppContext';
import { makeReport } from '../data/reports';
import {
  setPendingUpload,
  validateUpload,
  type FileValidationError,
} from '../services/api';
import { clearPendingConfirm } from '../utils/persistence';

/**
 * Selecting + validating a lab report before handing it off to the
 * processing pipeline.
 *
 * Validation is mime-type + size only — we used to also run a
 * "filename looks like a lab report" heuristic and reject IMG_4421.jpg
 * before parsing, but that was hostile UX for users uploading a photo
 * of a real report with a camera-roll name. The parser itself now
 * reports zero-match cases via the ProcessingPage error state, which
 * is grounded in actual content rather than a guess at the filename.
 *
 * Remaining failure modes both surface as a thin inline alert above
 * the dropzone:
 *   - type → tried to upload .docx / .heic / anything not PDF or image
 *   - size → file > 20 MB
 */
export default function UploadPage() {
  const { reports, addReport, removeReport } = useReports();
  const { replace, navigate } = useNavigation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Keep the validated File around so we can hand it to the parser
   *  via setPendingUpload(...) when the user hits "Start analysing". */
  const fileRef = useRef<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<FileValidationError | null>(null);

  // Drag-enter/leave fire for every child element, not just the dropzone
  // boundary. Counting active drags is the standard workaround so the
  // "dragging" highlight doesn't flicker when the cursor moves over the
  // icon or label nested inside the dropzone.
  const [dragDepth, setDragDepth] = useState(0);
  const dragging = dragDepth > 0;

  const onSelect = (f: File | null) => {
    if (!f) return;
    const result = validateUpload(f);
    if (!result.ok) {
      setError(result.error);
      setFileName(null);
      fileRef.current = null;
      return;
    }
    setError(null);
    // Use the validator's sanitized name — file.name can carry bidi
    // overrides / control chars / multi-megabyte garbage. See
    // utils/sanitizeFilename.
    setFileName(result.safeName);
    fileRef.current = result.file;
  };

  const startProcessing = () => {
    // Sweep any existing 'processing' placeholder reports before adding
    // a new one. Scenario: user starts upload A → navigates away mid-
    // parse → starts upload B. Without this sweep, A's placeholder
    // stays orphaned forever (its File handle was overwritten by
    // setPendingUpload below). ProcessingPage picks the newest
    // 'processing' report and parses against B's File, so A is
    // unrecoverable. Removing A here cancels it cleanly.
    for (const r of reports) {
      if (r.status === 'processing') removeReport(r.id);
    }
    // Also drop any persisted confirm record — it's tied to a now-
    // removed placeholder report. Stale records would be ignored on
    // load (processingId mismatch), but clearing avoids the
    // accumulation and is the right hygiene as we replace the flow.
    clearPendingConfirm();

    const name = fileName ?? 'My lab report';
    const cleaned = name.replace(/\.[^.]+$/, '');
    const report = makeReport(cleaned || 'My lab report');
    addReport(report);
    // Hand the File over to the parser via the module-level bridge —
    // ProcessingPage will consume it on mount. Persisted state can't
    // hold a File so this is the lightest-weight handoff that works.
    setPendingUpload(fileRef.current);
    replace({ type: 'processing' });
  };

  const isInlineError =
    error?.kind === 'type' || error?.kind === 'size' || error?.kind === 'empty';

  /** Soft warning when the user picks a chunky file. Hard limit is 20MB
   *  (size error blocks the upload), but anything >5MB will stall a
   *  phone's tab for 20–30s during text extraction. Warning is
   *  informational, not blocking. */
  const fileSize = fileRef.current?.size ?? 0;
  const showLargeFileWarning = fileSize > 5 * 1024 * 1024;

  return (
    <div className="min-h-dvh pb-32 bg-canvas">
      <Header
        variant="page"
        title="Upload a report"
        subtitle="PDF, photo, or screenshot"
      />

      <Container size="narrow" className="pt-5">
        {/* Honest disclaimer about what the parser actually does. All
            work happens locally — pdfjs extracts text from PDFs,
            tesseract.js runs OCR on images (and PDFs with no text
            layer). The catalog matcher then pulls known biomarker
            shapes out of the resulting text. If extraction yields
            zero matches, the next screen shows a clear error rather
            than silently substituting sample data (the previous
            behaviour hallucinated values that weren't in the file). */}
        <div
          role="note"
          className="mb-4 flex items-start gap-2.5 rounded-[14px] border border-indigo-200 bg-indigo-50/70 px-4 py-3"
        >
          <Info size={16} className="text-indigo-700 shrink-0 mt-0.5" />
          <p className="text-[12.5px] leading-relaxed text-indigo-900">
            <span className="font-semibold">PDFs and photos are parsed in your browser</span> —
            text extraction or OCR, all locally. OCR can take 10–30 seconds
            on a phone. If we can’t recognise anything in your file, you’ll
            see a clear error — we don’t make up values to fill in. Your
            file never leaves your device.
          </p>
        </div>

        {/* Single dropzone — filename-heuristic gate removed, so we
            no longer swap in a clinical-error card pre-parse. Any
            "we couldn't read this" message now lives in
            ProcessingPage's ParseFailedView, grounded in actual
            extraction results rather than a filename guess. */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Card padded={false} className="overflow-hidden">
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragDepth((d) => d + 1);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragDepth((d) => Math.max(0, d - 1));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragDepth(0);
                    onSelect(e.dataTransfer.files?.[0] ?? null);
                  }}
                  onClick={() => inputRef.current?.click()}
                  className={`p-7 text-center cursor-pointer transition-colors ${
                    dragging ? 'bg-indigo-50' : 'bg-surface'
                  }`}
                >
                  <motion.div
                    animate={{
                      y: dragging ? -4 : 0,
                      scale: dragging ? 1.05 : 1,
                    }}
                    className="mx-auto grid place-items-center w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-700"
                  >
                    <UploadCloud size={28} />
                  </motion.div>
                  <div className="mt-4 font-display text-[18px] text-ink">
                    {fileName ?? 'Tap to choose a file'}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {fileName
                      ? 'Looks good. Hit start when you’re ready.'
                      : 'or drag and drop it here'}
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="grid grid-cols-2 border-t border-line">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      inputRef.current?.click();
                    }}
                    className="flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-50/60 min-h-12"
                  >
                    <FileText size={16} /> Pick PDF
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      inputRef.current?.click();
                    }}
                    className="flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-50/60 border-l border-line min-h-12"
                  >
                    <ImageIcon size={16} /> Use photo
                  </button>
                </div>
              </Card>
        </motion.div>

        {/* Soft warning — informational, not blocking. Shown when the
            picked file is big enough to make phone parsing feel slow,
            but still under the 20 MB hard limit. We surface it BEFORE
            the inline-error block so a user who picks a 21 MB file
            still sees the size error first. */}
        <AnimatePresence>
          {showLargeFileWarning && !isInlineError && (
            <motion.div
              key="large-file-note"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              role="note"
              className="mt-3 flex items-start gap-2.5 rounded-[14px] border border-attention/30 bg-attention-soft/60 px-4 py-3"
            >
              <Info size={16} className="text-attention shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink leading-relaxed">
                <span className="font-semibold">Heads up:</span> this is a
                large file — text extraction may take 20–30 seconds, especially
                on phones. Hang in there.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline alert for type/size errors — keeps the dropzone in
            place since these are usually one-character fixes the user
            can apply by picking another file. */}
        <AnimatePresence>
          {isInlineError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              role="alert"
              className="mt-3 flex items-start gap-2.5 rounded-[14px] border border-concern/30 bg-concern-soft px-4 py-3"
            >
              <AlertTriangle size={16} className="text-concern shrink-0 mt-0.5" />
              <p className="text-[13px] text-concern leading-relaxed">
                {error?.message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 grid gap-3">
          <Card className="bg-surface">
            <div className="flex items-start gap-3">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-good-soft text-good shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="font-semibold text-[14.5px]">
                  Private, end to end
                </div>
                <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
                  Reports are processed for your eyes only. You can delete any
                  upload at any time.
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-2 px-1">
            <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted mb-2">
              Labs we read fluently
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Thyrocare',
                'Dr Lal Pathlabs',
                'SRL',
                'Metropolis',
                'Apollo',
                'Healthians',
              ].map((l) => (
                <span
                  key={l}
                  className="px-2.5 py-1 rounded-full bg-surface border border-line text-[11px] text-ink-soft"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* Manual-entry escape hatch — for users who'd rather type
              the values they care about than upload a PDF, or whose
              report layout the parser can't handle. */}
          <div className="mt-3 px-1 text-center">
            <button
              type="button"
              onClick={() => navigate({ type: 'manualEntry' })}
              className="text-[12.5px] text-indigo-700 hover:text-indigo-900 font-semibold underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-700 transition-colors"
            >
              Or enter values manually instead →
            </button>
          </div>
        </div>
      </Container>

      <StickyBottomBar>
        <Container size="narrow">
          <Button
            size="lg"
            fullWidth
            disabled={!fileName}
            onClick={startProcessing}
            trailing={<ArrowRight size={18} />}
          >
            Start analysing
          </Button>
        </Container>
      </StickyBottomBar>
    </div>
  );
}
