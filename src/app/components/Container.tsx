import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /**
   * wide:   expands to a comfortable laptop width on `lg+` (default —
   *         every dashboard/report/profile/landing screen wants this).
   * narrow: phone-style centered column (for single-flow screens like
   *         Quiz, Upload, and Processing).
   */
  size?: 'narrow' | 'wide';
  className?: string;
};

export default function Container({
  children,
  size = 'wide',
  className = '',
}: Props) {
  // Container max-width ramp, pulled one breakpoint earlier so iPad
  // portrait (768px) gets the wide desktop track instead of the narrow
  // mobile track. Was md→lg→xl; now sm→md→lg. Same shift applied to
  // Header.tsx so the two stay aligned.
  const widthCls =
    size === 'wide'
      ? 'max-w-md sm:max-w-3xl md:max-w-5xl lg:max-w-6xl'
      : 'max-w-md';
  return (
    <div
      className={`mx-auto w-full ${widthCls} px-5 sm:px-6 md:px-8 ${className}`}
    >
      {children}
    </div>
  );
}
