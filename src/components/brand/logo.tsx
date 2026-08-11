import * as React from 'react';
import { cn } from '@/lib/utils';

export function LogoMark({
  className,
  monochrome = false,
  title,
}: {
  className?: string;
  monochrome?: boolean;
  title?: string;
}) {
  const gradientId = React.useId();
  const fill = monochrome ? 'currentColor' : `url(#${gradientId})`;

  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('h-8 w-8', className)}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {monochrome ? null : (
        <defs>
          <linearGradient id={gradientId} x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#74F5D4" />
            <stop offset="0.48" stopColor="#28C59E" />
            <stop offset="1" stopColor="#117B69" />
          </linearGradient>
        </defs>
      )}

      {monochrome ? null : <circle cx="24" cy="24" r="19" fill="#07131B" opacity="0.92" />}
      <circle cx="24" cy="24" r="21" stroke={fill} strokeWidth="2.8" opacity={monochrome ? 1 : 0.88} />
      {monochrome ? null : (
        <circle cx="24" cy="24" r="20.2" stroke="#D7FFF6" strokeWidth="0.8" opacity="0.22" />
      )}

      {[0, 90, 180, 270].map((angle) => (
        <path
          key={angle}
          d="M24 8 C31.5 12 36 17 36 24 C29 24 24 19.5 24 8 Z"
          fill={fill}
          opacity={angle % 180 === 0 ? 1 : 0.86}
          transform={`rotate(${angle} 24 24)`}
        />
      ))}

      <circle cx="24" cy="24" r="4.2" fill={fill} />
      <circle cx="22.4" cy="22.4" r="1.6" fill="#FFFFFF" opacity="0.96" />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  monochrome,
}: {
  className?: string;
  markClassName?: string;
  monochrome?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={markClassName} monochrome={monochrome} />
      <span className="font-semibold tracking-tight">
        Nutre<span className="text-primary">luma</span>
      </span>
    </span>
  );
}
