/* ------------------------------------------------------------------ */
/* Summary chip — used in the confirm hero to render the concern/      */
/* attention/good counts. Kept separate from Pill because the visual   */
/* treatment is heavier: dot + bold count + descriptor, sized for a    */
/* hero summary not an inline tag.                                     */
/* ------------------------------------------------------------------ */

export default function SummaryChip({
  tone,
  count,
  label,
}: {
  tone: 'critical' | 'concern' | 'attention' | 'good';
  count: number;
  label: string;
}) {
  // Critical uses the inverted solid-fill treatment (white text on
  // concern-color background) to break visual parity with the other
  // tiers — "see a doctor" should NOT read as a louder version of
  // "need care".
  if (tone === 'critical') {
    return (
      <div className="inline-flex items-center gap-2 pl-2.5 pr-3.5 h-9 rounded-full bg-concern text-on-status">
        <span className="w-2 h-2 rounded-full bg-white" aria-hidden />
        <span className="font-display text-body tabular-nums leading-none">
          {count}
        </span>
        <span className="text-caption font-medium leading-none">{label}</span>
      </div>
    );
  }
  const dot =
    tone === 'concern'
      ? 'bg-concern'
      : tone === 'attention'
        ? 'bg-attention'
        : 'bg-good';
  const bg =
    tone === 'concern'
      ? 'bg-concern-soft'
      : tone === 'attention'
        ? 'bg-attention-soft'
        : 'bg-good-soft';
  const text =
    tone === 'concern'
      ? 'text-concern'
      : tone === 'attention'
        ? 'text-attention'
        : 'text-good';
  return (
    <div
      className={`inline-flex items-center gap-2 pl-2.5 pr-3.5 h-9 rounded-full ${bg}`}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />
      <span
        className={`font-display text-body tabular-nums ${text} leading-none`}
      >
        {count}
      </span>
      <span className={`text-caption font-medium ${text} leading-none`}>
        {label}
      </span>
    </div>
  );
}
