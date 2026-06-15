/**
 * Plain-English colour key. The dashboard and Health Map encode status as
 * green / amber / red everywhere (rings, bars, dots, pills) but never said
 * what those colours mean — so a first-time or non-medical reader was left
 * guessing whether "72% green" was good or bad. This one-line legend
 * defines the language in words a 16-year-old reads without a glossary.
 */
export default function StatusKey({ className = '' }: { className?: string }) {
  const items = [
    { dot: 'bg-good', label: 'In a healthy range' },
    { dot: 'bg-attention', label: 'Keep an eye on it' },
    { dot: 'bg-concern', label: 'Worth a doctor’s look' },
  ];
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-micro text-muted ${className}`}
    >
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${i.dot}`} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  );
}
