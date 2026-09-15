import { cn } from '@/lib/utils';

// Official NutreLuma v4 Liquid Glass mark.
export function LogoMark({
  className,
  monochrome = false,
  title,
}: {
  className?: string;
  monochrome?: boolean;
  title?: string;
}) {
  const src = monochrome ? '/brand/mark-mono-white.png' : '/brand/mark.png';

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title ?? ''}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      draggable={false}
      className={cn('h-8 w-8 object-contain', className)}
    />
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
        Nutre<span className="text-primary">Luma</span>
      </span>
    </span>
  );
}
