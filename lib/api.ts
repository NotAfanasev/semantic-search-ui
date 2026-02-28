import type { Document, DocumentFormData, SearchResult } from "./types"

interface PythonSearchResult {
  score?: number
  doc_id?: string | number
  title?: string
  text?: string
}

interface PythonSearchResponse {
  results?: PythonSearchResult[]
}

interface PythonDocumentPayload {
  found?: boolean
  document?: {
    doc_id?: string | number
    title?: string
    text?: string
    created_at?: string
    updated_at?: string
  }
}

interface PythonDocumentsListPayload {
  documents?: Array<{
    doc_id?: string | number
    title?: string
    text?: string
    created_at?: string
    updated_at?: string
  }>
}

interface PythonUpsertPayload {
  document?: {
    doc_id?: string | number
    title?: string
    text?: string
    created_at?: string
    updated_at?: string
  }
}

export interface SearchDocumentPreview {
  id: string
  title: string
  content: string
}

const SEARCH_ENDPOINT = "/api/search"
const ADMIN_DOCS_ENDPOINT = "/api/admin/documents"

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function toSnippet(text: string, maxLength = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength)}...`
}

function mapSearchResult(item: PythonSearchResult, index: number): SearchResult {
  const id = String(item.doc_id ?? index)
  return {
    id,
    title: item.title?.trim() || `Документ ${id}`,
    snippet: toSnippet(item.text ?? ""),
    score: typeof item.score === "number" && Number.isFinite(item.score) ? item.score : 0,
  }
}

function mapDocument(raw: {
  doc_id?: string | number
  title?: string
  text?: string
  created_at?: string
  updated_at?: string
}): Document {
  const id = String(raw.doc_id ?? "")
  const createdAt = raw.created_at?.trim() || todayIso()
  return {
    id,
    title: raw.title?.trim() || `Документ ${id}`,
    content: raw.text ?? "",
    createdAt,
    updatedAt: raw.updated_at?.trim() || createdAt,
  }
}

async function assertOk(response: Response, context: string): Promise<void> {
  if (response.ok) return
  const body = await response.text()
  throw new Error(`${context} failed (${response.status}): ${body}`)
}

export async function searchDocuments(query: string): Promise<SearchResult[]> {
  const response = await fetch(SEARCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  await assertOk(response, "Search request")
  const payload = (await response.json()) as PythonSearchResponse
  const items = Array.isArray(payload.results) ? payload.results : []
  return items.map(mapSearchResult)
}

export async function getSearchDocumentById(id: string): Promise<SearchDocumentPreview | null> {
  const response = await fetch(`/api/document/${encodeURIComponent(id)}`)
  await assertOk(response, "Document request")
  const payload = (await response.json()) as PythonDocumentPayload
  if (!payload.found || !payload.document) return null
  return {
    id: String(payload.document.doc_id ?? id),
    title: payload.document.title?.trim() || `Документ ${id}`,
    content: payload.document.text ?? "",
  }
}

export async function getDocument(id: string): Promise<Document | null> {
  const response = await fetch(`/api/document/${encodeURIComponent(id)}`)
  await assertOk(response, "Document request")
  const payload = (await response.json()) as PythonDocumentPayload
  if (!payload.found || !payload.document) return null
  return mapDocument(payload.document)
}

export async function listAdminDocuments(): Promise<Document[]> {
  const response = await fetch(ADMIN_DOCS_ENDPOINT, { cache: "no-store" })
  await assertOk(response, "List documents request")
  const payload = (await response.json()) as PythonDocumentsListPayload
  const docs = Array.isArray(payload.documents) ? payload.documents : []
  return docs.map(mapDocument)
}

export async function createAdminDocument(data: DocumentFormData): Promise<Document> {
  const response = await fetch(ADMIN_DOCS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: data.title, text: data.content }),
  })
  await assertOk(response, "Create document request")
  const payload = (await response.json()) as PythonUpsertPayload
  if (!payload.document) {
    throw new Error("Create document request failed: empty payload")
  }
  return mapDocument(payload.document)
}

export async function updateAdminDocument(id: string, data: DocumentFormData): Promise<Document> {
  const response = await fetch(`${ADMIN_DOCS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: data.title, text: data.content }),
  })
  await assertOk(response, "Update document request")
  const payload = (await response.json()) as PythonUpsertPayload
  if (!payload.document) {
    throw new Error("Update document request failed: empty payload")
  }
  return mapDocument(payload.document)
}

export async function deleteAdminDocument(id: string): Promise<void> {
  const response = await fetch(`${ADMIN_DOCS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  await assertOk(response, "Delete document request")
}
