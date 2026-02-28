import Link from "next/link"
import type { SearchResult } from "@/lib/types"
import { RelevanceBadge } from "./relevance-badge"
import { ArrowRight } from "lucide-react"

interface ResultCardProps {
  result: SearchResult
  index: number
}

export function ResultCard({ result, index }: ResultCardProps) {
  return (
    <div
      className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-foreground/10"
      style={{
        animation: `fadeInUp 0.4s ease-out ${index * 0.08}s both`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {result.title}
            </h3>
            <RelevanceBadge score={result.score} />
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
            {result.snippet}
          </p>
        </div>
        <Link
          href={`/document/${result.id}`}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground transition-all duration-200 hover:bg-secondary hover:border-foreground/10 hover:scale-[1.02] active:scale-[0.98]"
        >
          Открыть
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}
