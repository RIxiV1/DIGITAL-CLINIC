type Props = {
  /** Path under /public, e.g. "/illustrations/empty-reports.svg". */
  src: string;
  className?: string;
  /** Decorative by default — adjacent copy carries the meaning, so the
   *  image is hidden from assistive tech. Pass alt only when the image
   *  is the sole carrier of meaning. */
  alt?: string;
};

/**
 * Self-hosted product illustration (unDraw SVGs in /public/illustrations,
 * recolored to the brand accent). The chosen art is object-forward, so it
 * reads on both the light and dark themes without per-theme variants.
 *
 * Lazy + async so it never blocks paint; non-draggable / non-interactive
 * so it can't be picked up as a drag payload or steal clicks from a
 * surrounding control (e.g. the upload dropzone button).
 */
export default function Illustration({ src, className = '', alt = '' }: Props) {
  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`pointer-events-none select-none ${className}`}
    />
  );
}
