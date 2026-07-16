import { useEffect, useState } from 'react';

/**
 * Types `text` out character-by-character for the live processing status
 * line. When `enabled` is false (reduced-motion), it returns the full
 * string immediately — no animation. Resets and re-types whenever the
 * source text changes (e.g. the pipeline advances a stage). Capped speed so
 * a long OCR-stall message still finishes typing well before it changes.
 */
export function useTypewriter(text: string, enabled: boolean): string {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (!enabled) {
      setShown(text);
      return;
    }
    setShown('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
  }, [text, enabled]);
  return shown;
}
