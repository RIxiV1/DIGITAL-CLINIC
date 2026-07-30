import type { Report } from '../data/reports';
import { reportShareText, whatsappShareUrl } from './shareText';

/**
 * Share a report — best channel the device offers.
 *
 * On a phone (the primary audience) this opens the NATIVE share sheet with
 * the one-page doctor PDF attached, so the summary reaches WhatsApp — or any
 * app — as a real file the user can forward to a doctor, in two taps.
 *
 * Everywhere else the PDF is DOWNLOADED before we open the text channel, so
 * the document always exists somewhere the user can attach it. The two paths
 * that skip this used to lose it silently: desktop (wa.me carries text only)
 * and any browser whose share sheet refuses files. In both, a user who asked
 * to send their doctor a summary sent a paragraph instead.
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

/** Save the brief to the user's device. Used on every path that can't hand
 *  the file to the share sheet directly, so "share" never silently becomes
 *  "share some text" — the PDF is at least sitting in Downloads, ready to
 *  attach to the WhatsApp thread we're about to open. */
function downloadBrief(blob: Blob, report: Report): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `formen-doctor-summary-${slugify(report.name)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function shareReport(report: Report): Promise<void> {
  const text = reportShareText(report);
  const title = `Blood test summary - ${report.name}`;

  // Build the one-page doctor PDF up front — every path below wants it, and
  // on the fallback paths it's the difference between sending a doctor a
  // document and sending them a paragraph. Lazy import keeps jspdf out of
  // the main bundle; it's only paid when a user shares.
  let blob: Blob | null = null;
  try {
    const { buildDoctorBrief } = await import('../services/reportPdf');
    blob = buildDoctorBrief(report).output('blob') as Blob;
  } catch {
    // PDF build failed — still let the user share the text summary.
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const file = blob
      ? new File([blob], `formen-doctor-summary-${slugify(report.name)}.pdf`, {
          type: 'application/pdf',
        })
      : null;
    const canFiles =
      !!file &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] });
    try {
      if (canFiles && file) {
        await navigator.share({ files: [file], text, title });
        return;
      }
      // Share exists but won't take the file. Previously this shared the
      // text alone and returned, so the user tapped "share the PDF" and sent
      // a paragraph — with no way to tell. Save the file first, then share
      // the text, so both actually reach the recipient.
      if (blob) downloadBrief(blob, report);
      await navigator.share({ text, title });
      return;
    } catch (err) {
      // User dismissed the sheet → respect it, don't fall through to wa.me.
      if (err instanceof Error && err.name === 'AbortError') return;
      // Anything else (unsupported combo, activation lost mid-await) →
      // degrade to the wa.me text link below.
    }
  }

  // Desktop / no Web Share. wa.me can only carry text, so download the PDF
  // alongside it — otherwise the desktop path is the one place "share with
  // your doctor" produces no document at all.
  if (blob) downloadBrief(blob, report);
  window.open(whatsappShareUrl(text), '_blank', 'noopener,noreferrer');
}
