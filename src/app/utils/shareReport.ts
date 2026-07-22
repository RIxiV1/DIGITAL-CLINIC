import type { Report } from '../data/reports';
import { reportShareText, whatsappShareUrl } from './shareText';

/**
 * Share a report — best channel the device offers.
 *
 * On a phone (the primary audience) this opens the NATIVE share sheet with
 * the one-page doctor PDF attached, so the summary reaches WhatsApp — or any
 * app — as a real file the user can forward to a doctor, in two taps. Where
 * the Web Share API (or file sharing) isn't available — most desktop
 * browsers — it falls back to the original `wa.me` deep link with the text
 * pre-filled.
 *
 * Everything is user-initiated: the native sheet / wa.me only stages the
 * content; nothing sends until the user picks a recipient. Dismissing the
 * sheet (AbortError) is a normal outcome and does nothing — we do NOT then
 * pop open wa.me behind their back.
 */

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report'
  );
}

export async function shareReport(report: Report): Promise<void> {
  const text = reportShareText(report);
  const title = `Blood test summary - ${report.name}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      // Build the concise one-page doctor PDF to attach. Lazy import keeps
      // jspdf out of the main bundle; it's only paid when a user shares.
      const { buildDoctorBrief } = await import('../services/reportPdf');
      const blob = buildDoctorBrief(report).output('blob') as Blob;
      const file = new File(
        [blob],
        `formen-doctor-summary-${slugify(report.name)}.pdf`,
        { type: 'application/pdf' },
      );
      const canFiles =
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });
      await navigator.share(
        canFiles ? { files: [file], text, title } : { text, title },
      );
      return;
    } catch (err) {
      // User dismissed the sheet → respect it, don't fall through to wa.me.
      if (err instanceof Error && err.name === 'AbortError') return;
      // Anything else (unsupported combo, activation lost mid-await, a PDF
      // build hiccup) → degrade to the wa.me text link below.
    }
  }

  // Fallback: WhatsApp with the text pre-filled (desktop / no Web Share).
  window.open(whatsappShareUrl(text), '_blank', 'noopener,noreferrer');
}
