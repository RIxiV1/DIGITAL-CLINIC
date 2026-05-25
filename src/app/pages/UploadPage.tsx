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
  // Separate input for the "Use photo" path so its accept= filter can
  // narrow to image MIME types and its capture= hint can bias mobile
  // toward the camera. Sharing one input forced both buttons to accept
  // the same permissive set, defeating their visual differentiation.
  const photoInputRef = useRef<HTMLInputElement | null>(null);
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
          <p className="text-footnote leading-relaxed text-indigo-900">
            <span className="font-semibold">PDFs and photos are parsed in your browser</span> —
            text extraction or OCR, all locally. OCR can take 10–30 seconds
            on a phone. If we can’t recognise anything in your file, you’ll
            see a clear error — we don’t make up values to fill in. Your
            file never leaves your device.
          </p>
        </div>

        {/* Dropzone — dashed border affordance, real drag-state visual,
            and distinct PDF/Photo entry points with their own filters.
            The previous version was a flat white card with two
            identical buttons that both opened the same file input;
            now the dropzone reads as a drop target the moment users
            see it (dashed border), and the two action rails respect
            their declared file types so the iOS share sheet doesn't
            offer "Files" when the user tapped "Use photo". */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <button
            type="button"
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
            aria-label={
              fileName
                ? `Chosen file: ${fileName}. Tap to choose a different file.`
                : 'Choose or drop a lab report'
            }
            className={`group relative block w-full p-7 sm:p-8 rounded-[20px] border-2 border-dashed text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 ${
              dragging
                ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100/60'
                : fileName
                  ? 'border-good/50 bg-good-soft/30 hover:border-good'
                  : 'border-line-strong bg-surface hover:border-blue-400 hover:bg-blue-50/40'
            }`}
          >
            <motion.div
              animate={{
                y: dragging ? -6 : 0,
                scale: dragging ? 1.06 : 1,
                rotate: dragging ? -3 : 0,
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className={`mx-auto grid place-items-center w-16 h-16 rounded-3xl transition-colors ${
                fileName
                  ? 'bg-good-soft text-good'
                  : 'bg-blue-50 text-blue-700 group-hover:bg-blue-100'
              }`}
            >
              {fileName ? <FileText size={28} /> : <UploadCloud size={28} />}
            </motion.div>
            <div className="mt-4 font-display text-body-lg text-ink leading-tight break-words">
              {fileName ?? (dragging ? 'Drop it here' : 'Tap to choose a file')}
            </div>
            <div className="mt-1.5 text-meta text-muted">
              {fileName
                ? 'Looks good. Hit start when you’re ready.'
                : dragging
                  ? 'Release to upload'
                  : 'or drag and drop a PDF / photo here'}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
            />
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              // capture=environment hints mobile to open the camera
              // on the back-facing lens instead of the photo library.
              // Falls back to the photo library on browsers that
              // don't support the hint, which is the desired UX
              // anyway — no harm in declaring the preference.
              capture="environment"
              className="hidden"
              onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
            />
          </button>

          {/* Action rails — visually distinct, semantically different.
              Pick PDF accepts only `application/pdf`; Use photo
              accepts JPEG/PNG/WebP and hints at the camera. Was
              previously two identical buttons opening the same
              promiscuous input. */}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              className="flex flex-col items-center gap-1 py-3 rounded-[14px] bg-surface border border-line text-blue-700 hover:bg-blue-50 hover:border-blue-200 active:bg-blue-100 transition-colors min-h-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            >
              <FileText size={18} />
              <div className="text-meta font-semibold leading-none">
                Pick a PDF
              </div>
              <div className="text-eyebrow text-muted leading-none">
                from your files
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                photoInputRef.current?.click();
              }}
              className="flex flex-col items-center gap-1 py-3 rounded-[14px] bg-surface border border-line text-blue-700 hover:bg-blue-50 hover:border-blue-200 active:bg-blue-100 transition-colors min-h-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            >
              <ImageIcon size={18} />
              <div className="text-meta font-semibold leading-none">
                Use photo
              </div>
              <div className="text-eyebrow text-muted leading-none">
                camera or roll
              </div>
            </button>
          </div>
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
              <p className="text-footnote text-ink leading-relaxed">
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
              <p className="text-meta text-concern leading-relaxed">
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
                <div className="font-semibold text-ui-sm">
                  Private, end to end
                </div>
                <p className="text-meta text-ink-soft mt-1 leading-relaxed">
                  Reports are processed for your eyes only. You can delete any
                  upload at any time.
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-2 px-1">
            <div className="text-eyebrow uppercase tracking-[0.14em] font-bold text-muted mb-2">
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
                  className="px-2.5 py-1 rounded-full bg-surface border border-line text-caption text-ink-soft"
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
              className="text-footnote text-indigo-700 hover:text-indigo-900 font-semibold underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-700 transition-colors"
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
