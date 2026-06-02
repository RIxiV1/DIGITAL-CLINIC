/**
 * Shimmer-pulse placeholders used as Suspense fallbacks while lazy page
 * chunks are being fetched. A skeleton reads as "this is loading" where
 * an empty div reads as "is this broken?" — even at the 30-150ms window
 * a page chunk typically takes on a real connection.
 *
 * Primitive + a handful of layout presets that approximate the actual
 * pages. Picking the right preset by Page.type means each lazy boundary
 * shows the shape of what's coming, not a generic gray block.
 */

/** Pulsing rectangle. Default rounded; pass overrides via className. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`bg-line/60 animate-pulse rounded-md ${className}`}
    />
  );
}

/** Top app-chrome strip used by most pages — logo placeholder + a CTA. */
function ChromeSkeleton({ tone = 'page' }: { tone?: 'page' | 'landing' }) {
  return (
    <div className="border-b border-line/70 px-5 md:px-8 h-16 flex items-center gap-4 bg-canvas">
      <Skeleton className="w-20 h-6" />
      <div className="flex-1" />
      {tone === 'landing' && (
        <>
          <Skeleton className="hidden md:block w-40 h-4" />
          <Skeleton className="hidden md:block w-12 h-4" />
        </>
      )}
      <Skeleton className="w-28 h-9 rounded-full" />
    </div>
  );
}

/**
 * Generic content-page skeleton — heading, sub, then a few card-shaped
 * placeholders. Used for every page that doesn't have a dedicated
 * skeleton below. Picks the right top chrome based on whether the
 * destination is the landing surface or an in-app page.
 */
export function PageSkeleton({
  variant = 'page',
}: {
  variant?: 'page' | 'landing' | 'dashboard' | 'results';
}) {
  if (variant === 'landing') {
    return (
      <div className="min-h-dvh bg-canvas">
        <ChromeSkeleton tone="landing" />
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8 pt-14 md:pt-20 grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-6 space-y-5">
            <Skeleton className="w-40 h-7 rounded-full" />
            <Skeleton className="w-full h-12" />
            <Skeleton className="w-5/6 h-12" />
            <Skeleton className="w-3/4 h-5" />
            <div className="flex gap-3 mt-4">
              <Skeleton className="w-48 h-12 rounded-full" />
              <Skeleton className="w-40 h-12 rounded-full" />
            </div>
          </div>
          <div className="md:col-span-6">
            <Skeleton className="w-full aspect-square max-w-[480px] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className="min-h-dvh bg-canvas">
        <ChromeSkeleton />
        <div className="mx-auto w-full max-w-3xl px-5 md:px-8 pt-6 space-y-5">
          {/* Headline card */}
          <Skeleton className="w-full h-40 rounded-2xl" />
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          {/* Section heading + list */}
          <Skeleton className="w-32 h-5 mt-4" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (variant === 'results') {
    return (
      <div className="min-h-dvh bg-canvas">
        <ChromeSkeleton />
        <div className="mx-auto w-full max-w-3xl px-5 md:px-8 pt-6 space-y-4">
          {/* Report header card */}
          <Skeleton className="w-full h-28 rounded-2xl" />
          {/* Top-line read */}
          <Skeleton className="w-full h-20 rounded-2xl" />
          {/* Marker rows by category */}
          <Skeleton className="w-40 h-5 mt-4" />
          <Skeleton className="w-full h-16 rounded-xl" />
          <Skeleton className="w-full h-16 rounded-xl" />
          <Skeleton className="w-full h-16 rounded-xl" />
          <Skeleton className="w-40 h-5 mt-4" />
          <Skeleton className="w-full h-16 rounded-xl" />
          <Skeleton className="w-full h-16 rounded-xl" />
        </div>
      </div>
    );
  }

  // Default generic content page
  return (
    <div className="min-h-dvh bg-canvas">
      <ChromeSkeleton />
      <div className="mx-auto w-full max-w-3xl px-5 md:px-8 pt-8 space-y-4">
        <Skeleton className="w-32 h-6 rounded-full" />
        <Skeleton className="w-full h-10" />
        <Skeleton className="w-3/4 h-4" />
        <Skeleton className="w-1/2 h-4" />
        <div className="mt-6 grid gap-3">
          <Skeleton className="w-full h-24 rounded-2xl" />
          <Skeleton className="w-full h-24 rounded-2xl" />
          <Skeleton className="w-full h-24 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
