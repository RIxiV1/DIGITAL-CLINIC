import Pill from '../../components/Pill';

export default function SectionHeading({
  eyebrow,
  eyebrowTone = 'indigo',
  title,
  subtitle,
  rightSlot,
}: {
  eyebrow: string;
  /** Pill tone for the eyebrow. Defaults to brand indigo; the top-concern
   *  heading passes 'concern' for a critical marker so the section's
   *  urgency matches the card's "talk to a doctor today" framing instead
   *  of a casual "worth a look". */
  eyebrowTone?: React.ComponentProps<typeof Pill>['tone'];
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <Pill tone={eyebrowTone} size="sm">
          {eyebrow}
        </Pill>
        <h2 className="font-display text-display-md leading-tight mt-2">
          {title}
        </h2>
        {subtitle && (
          <p className="text-caption text-ink-soft mt-1">{subtitle}</p>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}
