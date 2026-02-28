import type { SearchResult } from "@/lib/types"
import { RelevanceBadge } from "./relevance-badge"
import { DocumentPreviewDialog } from "./document-preview-dialog"

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
        <DocumentPreviewDialog docId={result.id} />
      </div>
    </div>
  )
}
