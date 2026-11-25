import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder with the editor's layout while it loads. A plain component (no
 * "use client"), so server pages can use it as a Suspense fallback.
 */
export function WorkspaceSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Loading invoice">
      <div className="flex h-12 items-center gap-3 border-b px-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="ml-auto h-8 w-72" />
      </div>
      <div className="grid flex-1 grid-cols-[55fr_45fr]">
        <div className="bg-muted/60 p-8 dark:bg-black/30">
          <Skeleton className="mx-auto aspect-[1/1.41] w-full max-w-[560px]" />
        </div>
        <div className="space-y-3 border-l p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
