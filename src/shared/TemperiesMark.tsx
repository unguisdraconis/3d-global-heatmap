import { useId } from 'react';

interface TemperiesMarkProps {
  className?: string;
  size?: number;
}

export function TemperiesMark({ className, size = 32 }: TemperiesMarkProps) {
  const clipId = `temperies-disc-${useId().replaceAll(':', '')}`;
  return <svg
    aria-hidden="true"
    className={['temperies-mark', className].filter(Boolean).join(' ')}
    focusable="false"
    height={size}
    viewBox="0 0 64 64"
    width={size}
  >
    <defs>
      <clipPath id={clipId}><circle cx="32" cy="32" r="25" /></clipPath>
    </defs>
    <circle cx="32" cy="32" r="25" fill="#4937b8" />
    <path
      clipPath={`url(#${clipId})`}
      d="M0 0H64V29C52 38 43 38 37 27C31 16 19 14 0 25Z"
      fill="#f28b5b"
    />
    <path
      d="M7.5 24.8C21.5 16.2 31.8 17.8 37 27.8C42.2 38 49.7 40.1 56.7 35"
      fill="none"
      stroke="#78e1c0"
      strokeLinecap="round"
      strokeWidth="3"
    />
    <circle cx="32" cy="32" r="25" fill="none" stroke="#78e1c0" strokeWidth="2.4" />
  </svg>;
}
