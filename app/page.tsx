"use client"

import { useState, useCallback } from "react"
import { SearchBar } from "@/components/search-bar"
import { ResultCard } from "@/components/result-card"
import { LoadingState } from "@/components/loading-state"
import { EmptyState, NoResultsState, ErrorState } from "@/components/states"
import { Header } from "@/components/header"
import { searchDocuments } from "@/lib/api"
import type { SearchResult, SearchState } from "@/lib/types"

export default function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [state, setState] = useState<SearchState>("idle")
  const [lastQuery, setLastQuery] = useState("")

  const handleSearch = useCallback(async (query: string) => {
    setState("loading")
    setLastQuery(query)

    try {
      const data = await searchDocuments(query)
      if (data.length === 0) {
        setState("empty")
      } else {
        setResults(data)
        setState("success")
      }
    } catch {
      setState("error")
    }
  }, [])

  const handleRetry = useCallback(() => {
    if (lastQuery) {
      handleSearch(lastQuery)
    }
  }, [lastQuery, handleSearch])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-[900px] mx-auto px-6 py-10">
        <div className="mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
            Поиск по базе знаний
          </h1>
          <p className="mt-2 text-muted-foreground text-base leading-relaxed">
            Найдите нужную информацию с помощью семантического поиска
          </p>
        </div>

        <div className="mt-8 mb-10">
          <SearchBar onSearch={handleSearch} isLoading={state === "loading"} />
        </div>

        {state === "idle" && <EmptyState />}
        {state === "loading" && <LoadingState />}
        {state === "empty" && <NoResultsState />}
        {state === "error" && <ErrorState onRetry={handleRetry} />}
        {state === "success" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {"Найдено результатов: "}
              <span className="font-medium text-foreground">{results.length}</span>
            </p>
            <div className="space-y-3">
              {results.map((result, index) => (
                <ResultCard key={`${result.id}-${index}`} result={result} index={index} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
