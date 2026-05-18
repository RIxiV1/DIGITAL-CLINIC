type Props = {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'dark' | 'light';
};

export default function Logo({ size = 'md', tone = 'dark' }: Props) {
  const text =
    size === 'sm'
      ? 'text-[14px]'
      : size === 'md'
        ? 'text-[15.5px]'
        : 'text-[18px]';
  const mark =
    size === 'sm' ? 'w-7 h-7' : size === 'md' ? 'w-8 h-8' : 'w-10 h-10';

  const brandColor = tone === 'dark' ? 'text-ink' : 'text-white';
  const subColor = tone === 'dark' ? 'text-ink-soft' : 'text-white/85';
  const dotColor = tone === 'dark' ? 'text-blue-600' : 'text-blue-200';

  return (
    <div
      className="inline-flex items-center gap-2 select-none"
      aria-label="ForMen · Digital Clinic"
    >
      <div
        className={`${mark} rounded-xl grid place-items-center bg-blue-600 text-white shadow-soft`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-[60%] h-[60%]"
          aria-hidden
        >
          <path d="M3 12 H7 L9.2 6.5 L13 18 L15 12 H21" />
        </svg>
      </div>
      <span
        className={`font-sans tracking-[-0.01em] leading-none ${text} flex items-baseline gap-1.5`}
      >
        <span className={`font-bold ${brandColor}`}>ForMen</span>
        <span className={`${dotColor} font-bold`}>·</span>
        <span className={`font-medium ${subColor}`}>Digital Clinic</span>
      </span>
    </div>
  );
}
