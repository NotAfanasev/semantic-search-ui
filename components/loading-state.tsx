export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-5 w-48 bg-muted rounded-md" />
            <div className="h-5 w-12 bg-muted rounded-md" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded-md" />
            <div className="h-4 w-3/4 bg-muted rounded-md" />
          </div>
        </div>
        <div className="h-9 w-28 bg-muted rounded-lg shrink-0" />
      </div>
    </div>
  )
}

export function LoadingState() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
