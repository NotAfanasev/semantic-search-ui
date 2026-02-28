interface RelevanceBadgeProps {
  score: number
}

export function RelevanceBadge({ score }: RelevanceBadgeProps) {
  const formattedScore = score.toFixed(2)

  let bgClass: string
  let textClass: string

  if (score >= 0.8) {
    bgClass = "bg-success/10"
    textClass = "text-success"
  } else if (score >= 0.5) {
    bgClass = "bg-warning/10"
    textClass = "text-warning-foreground"
  } else {
    bgClass = "bg-muted"
    textClass = "text-muted-foreground"
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium tabular-nums ${bgClass} ${textClass}`}
    >
      {formattedScore}
    </span>
  )
}
