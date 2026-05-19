import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import { useApp } from '../AppContext';
import { makeReport } from '../data/reports';

export default function UploadPage() {
  const { addReport, replace } = useApp();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // Drag-enter/leave fire for every child element, not just the dropzone
  // boundary. Counting active drags is the standard workaround so the
  // "dragging" highlight doesn't flicker when the cursor moves over the
  // icon or label nested inside the dropzone.
  const [dragDepth, setDragDepth] = useState(0);
  const dragging = dragDepth > 0;

  const onSelect = (f: File | null) => {
    if (f) setFileName(f.name);
  };

  const startProcessing = () => {
    const name = fileName ?? 'My lab report';
    const cleaned = name.replace(/\.[^.]+$/, '');
    const report = makeReport(cleaned || 'My lab report');
    addReport(report);
    replace({ type: 'processing' });
  };

  return (
    <div className="min-h-screen pb-32 bg-canvas">
      <Header
        variant="page"
        title="Upload a report"
        subtitle="PDF, photo, or screenshot"
      />

      <Container size="narrow" className="pt-5">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
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
                dragging ? 'bg-indigo-50' : 'bg-white'
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
                className="flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-50/60"
              >
                <FileText size={16} /> Pick PDF
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                className="flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-50/60 border-l border-line"
              >
                <ImageIcon size={16} /> Use photo
              </button>
            </div>
          </Card>
        </motion.div>

        <div className="mt-6 grid gap-3">
          <Card className="bg-white">
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
                  className="px-2.5 py-1 rounded-full bg-white border border-line text-[11px] text-ink-soft"
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
            disabled={!fileName}
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
