import { Skeleton } from '@/components/ui/misc';

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
