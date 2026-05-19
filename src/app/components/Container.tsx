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
  const widthCls =
    size === 'wide'
      ? 'max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl'
      : 'max-w-md';
  return (
    <div
      className={`mx-auto w-full ${widthCls} px-5 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}
