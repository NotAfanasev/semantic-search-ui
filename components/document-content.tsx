"use client"

import Link from "next/link"
import { ArrowLeft, Calendar } from "lucide-react"
import type { Document } from "@/lib/types"

interface DocumentContentProps {
  document: Document
}

export function DocumentContent({ document }: DocumentContentProps) {
  return (
    <article
      className="animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground font-medium transition-all duration-200 hover:text-foreground group mb-8"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Назад к поиску
      </Link>

      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-card-foreground text-balance mb-4">
          {document.title}
        </h1>

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-8">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {"Обновлено: "}
            {new Date(document.updatedAt).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        <div className="h-px bg-border mb-8" role="separator" />

        <div className="text-foreground text-base leading-relaxed whitespace-pre-line">
          {document.content}
        </div>
      </div>
    </article>
  )
}
