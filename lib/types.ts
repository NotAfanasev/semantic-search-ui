export interface SearchResult {
  id: string
  title: string
  snippet: string
  score: number
}

export interface Document {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export type SearchState = "idle" | "loading" | "success" | "empty" | "error"

export interface DocumentFormData {
  title: string
  content: string
}
