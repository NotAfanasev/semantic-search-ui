import type { SearchResult, Document } from "./types"
import { findMockResults, findMockDocument } from "./mock-data"

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function searchDocuments(query: string): Promise<SearchResult[]> {
  await delay(800)
  return findMockResults(query)
}

export async function getDocument(id: string): Promise<Document | null> {
  await delay(500)
  const doc = findMockDocument(id)
  return doc ?? null
}
