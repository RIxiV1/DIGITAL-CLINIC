import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import Button from '../../components/Button';
import Container from '../../components/Container';
import Logo from '../../components/Logo';
import { AI_PARSER_PRIVACY_COPY } from '../../services/aiParser';

/* ================================================================== */
/* AI auto-cascade view — local parser failed on an image, Gemini is    */
/* running in the background. Shows a spinner + the privacy disclosure  */
/* inline (so consent stays just-in-time) + a prominent Cancel button   */
/* that aborts the in-flight fetch and drops the user back to the       */
/* manual failure card.                                                  */
/* ================================================================== */

export default function AiCascadeView({
  fileName,
  onCancel,
}: {
  fileName: string;
  onCancel: () => void;
}) {
  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      <Container size="narrow" className="pt-6">
        <Logo />
      </Container>

      <Container
        size="narrow"
        className="flex-1 flex flex-col items-center justify-center text-center pb-16"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="relative"
          aria-hidden="true"
        >
          <motion.div
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(0,102,204,0.20)',
                '0 0 0 28px rgba(0,102,204,0)',
              ],
            }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="grid place-items-center w-24 h-24 rounded-3xl bg-indigo-600 text-gold-400"
          >
            <Sparkles size={44} />
          </motion.div>
        </motion.div>

        <h1 className="font-display text-display-md leading-tight mt-7 text-balance max-w-[22rem]">
          Trying AI parser
        </h1>
        <p className="mt-2 text-body-sm text-ink-soft max-w-[22rem] text-pretty">
          Our on-device read couldn’t recognise this layout. Handing the image
          to Google Gemini for a second look.
        </p>

        {/* Privacy disclosure — same copy as the manual button on
            ParseFailedView, so users see consistent language whether
            they hit AI manually or via auto-cascade. Constant lives in
            aiParser.ts. */}
        <div
          role="note"
          aria-label="Privacy notice"
          className="mt-6 w-full max-w-sm rounded-2xl border border-line bg-surface px-4 py-3 text-left"
        >
          <div className="text-caption uppercase tracking-label font-bold text-muted">
            Heads up
          </div>
          <p className="mt-1 text-body-sm text-ink-soft text-pretty">
            {AI_PARSER_PRIVACY_COPY}
          </p>
          {fileName ? (
            <p className="mt-2 text-caption text-muted truncate">
              File: {fileName}
            </p>
          ) : null}
        </div>

        {/* Indeterminate spinner — we don't have step-level progress
            from the server, so an honest spinner beats a fake stage
            ladder here. */}
        <div className="mt-6 flex items-center gap-2 text-caption uppercase tracking-label font-bold text-muted">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full"
            aria-hidden="true"
          />
          <span>Usually 3–8 seconds</span>
        </div>

        <Button variant="secondary" size="md" onClick={onCancel} className="mt-8">
          Cancel and choose another option
        </Button>
      </Container>
    </div>
  );
}
