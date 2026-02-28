"use client"

import { useState, type FormEvent } from "react"
import { Search } from "lucide-react"

interface SearchBarProps {
  onSearch: (query: string) => void
  isLoading: boolean
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("")

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length > 0) {
      onSearch(trimmed)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Например: хочу оформить отпуск"
            className="w-full h-14 pl-12 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-foreground/20 text-base"
            disabled={isLoading}
            aria-label="Search query"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || query.trim().length === 0}
          className="h-14 px-8 rounded-xl bg-primary text-primary-foreground font-medium text-base shadow-sm transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isLoading ? "Поиск..." : "Найти"}
        </button>
      </div>
    </form>
  )
}
