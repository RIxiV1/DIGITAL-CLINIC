import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Info,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import { useNavigation, useReports } from '../AppContext';
import { makeReport, sampleReports } from '../data/reports';
import {
  setPendingUpload,
  validateUpload,
  type FileValidationError,
} from '../services/api';

/**
 * Selecting + validating a lab report before handing it off to the
 * processing pipeline.
 *
 * Failure modes the user can hit, in order of likelihood:
 *   - type   → tried to upload .docx, .heic, etc.
 *   - size   → file > 20 MB
 *   - unrecognized → filename doesn't look like a lab report (camera-
 *                    roll names like IMG_1234.jpg fall here)
 *
 * "type" and "size" surface as a thin inline alert above the dropzone.
 * "unrecognized" surfaces as a full clinical-error card with two recovery
 * paths — try a different file, or jump straight to a sample report so
 * the user can keep exploring the product without finding a real one.
 */
export default function UploadPage() {
  const { reports, addReport } = useReports();
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
    setFileName(result.file.name);
    fileRef.current = result.file;
  };

  const startProcessing = () => {
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

  /**
   * Recovery path when the filename heuristic rejects the upload. Loads
   * the first curated sample into the user's locker (if not already
   * there) and routes them to its results page, so they don't dead-end
   * on the error screen.
   */
  const loadSampleFallback = () => {
    const sample = sampleReports[0];
    if (!reports.some((r) => r.id === sample.id)) {
      addReport(sample);
    }
    setError(null);
    navigate({ type: 'results', reportId: sample.id });
  };

  const resetAndPickAgain = () => {
    setError(null);
    setFileName(null);
    // Open the file picker once the error card has dismounted so the
    // OS dialog feels like a continuation of the user's action.
    requestAnimationFrame(() => inputRef.current?.click());
  };

  const isClinicalError = error?.kind === 'unrecognized';
  const isInlineError =
    error?.kind === 'type' || error?.kind === 'size' || error?.kind === 'empty';

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

        {/* The clinical error replaces the dropzone entirely — it's a
            modal-style interruption, not a passing alert. The dropzone
            re-appears once the user clicks "Try a different file". */}
        <AnimatePresence mode="wait">
          {isClinicalError && error.kind === 'unrecognized' ? (
            <motion.div
              key="clinical-error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <Card padded={false} className="overflow-hidden">
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
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-concern">
                        Parsing failed
                      </div>
                      <h2 className="font-display text-[20px] leading-tight text-ink mt-1">
                        We couldn’t read this as a lab report.
                      </h2>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                        {error.message}
                      </p>
                      <div className="mt-3 rounded-[10px] bg-surface border border-line/70 px-3 py-2 text-[12px] text-muted break-all">
                        <span className="font-bold uppercase tracking-[0.12em] text-[10px] text-muted block mb-0.5">
                          File
                        </span>
                        {error.filename}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 grid sm:grid-cols-2 gap-2.5">
                  <Button
                    size="md"
                    variant="primary"
                    leading={<RotateCcw size={14} />}
                    onClick={resetAndPickAgain}
                    fullWidth
                  >
                    Try a different file
                  </Button>
                  <Button
                    size="md"
                    variant="secondary"
                    leading={<Sparkles size={14} />}
                    onClick={loadSampleFallback}
                    fullWidth
                  >
                    Use sample report
                  </Button>
                </div>

                <div className="px-5 pb-5 -mt-1">
                  <p className="text-[11.5px] text-muted leading-relaxed">
                    The parser scans filenames for lab-style words
                    (report, blood, lab, hormone, test). If your file is a
                    real lab document with a generic camera-roll name,
                    just rename it (e.g. <em>blood-test.pdf</em>) and try
                    again.
                  </p>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
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
        </div>
      </Container>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-canvas via-canvas/95 to-transparent pt-4 pb-4 safe-bottom">
        <Container size="narrow">
          <Button
            size="lg"
            fullWidth
            disabled={!fileName || isClinicalError}
            onClick={startProcessing}
            trailing={<ArrowRight size={18} />}
          >
            Start analysing
          </Button>
        </Container>
      </div>
    </div>
  );
}
