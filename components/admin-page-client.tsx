"use client"

import { useCallback, useEffect, useState } from "react"
import type { Document, DocumentFormData } from "@/lib/types"
import {
  createAdminDocument,
  deleteAdminDocument,
  listAdminDocuments,
  logoutAdmin,
  updateAdminDocument,
} from "@/lib/api"
import { DocumentFormDialog } from "@/components/document-form-dialog"
import { DeleteDocumentDialog } from "@/components/delete-document-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Pencil, Trash2, FileText, LogOut } from "lucide-react"
import { toast } from "sonner"

export function AdminPageClient() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)

  const refreshDocuments = useCallback(async () => {
    const data = await listAdminDocuments()
    setDocuments(data)
    setLoadError(false)
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const data = await listAdminDocuments()
        if (!cancelled) {
          setDocuments(data)
          setLoadError(false)
        }
      } catch {
        if (!cancelled) setLoadError(true)
        if (!cancelled) toast.error("Не удалось загрузить документы")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  function handleCreate() {
    setEditingDoc(null)
    setFormOpen(true)
  }

  function handleEdit(doc: Document) {
    setEditingDoc(doc)
    setFormOpen(true)
  }

  async function handleFormSubmit(data: DocumentFormData) {
    try {
      if (editingDoc) {
        const updated = await updateAdminDocument(editingDoc.id, data)
        toast.success("Документ обновлен", { description: updated.title })
      } else {
        const created = await createAdminDocument(data)
        toast.success("Документ создан", { description: created.title })
      }
      await refreshDocuments()
      setFormOpen(false)
      setEditingDoc(null)
    } catch {
      toast.error("Не удалось сохранить документ")
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return

    try {
      await deleteAdminDocument(deleteTarget.id)
      toast.success("Документ удален", { description: deleteTarget.title })
      await refreshDocuments()
      setDeleteTarget(null)
    } catch {
      toast.error("Не удалось удалить документ")
    }
  }

  async function handleLogout() {
    try {
      await logoutAdmin()
      window.location.reload()
    } catch {
      toast.error("Не удалось завершить сессию")
    }
  }

  function formatDate(dateStr: string) {
    const parsed = new Date(dateStr)
    if (Number.isNaN(parsed.getTime())) return "-"

    return parsed.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight text-balance">
            Управление документами
          </h1>
          <p className="text-sm text-muted-foreground">
            Создавайте, редактируйте и удаляйте документы базы знаний
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => void handleLogout()} className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Выйти</span>
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Добавить</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Badge variant="secondary" className="text-sm px-3 py-1 font-normal">
          {documents.length}{" "}
          {documents.length === 1 ? "документ" : documents.length < 5 ? "документа" : "документов"}
        </Badge>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Загрузка...</div>
      ) : loadError ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          style={{ animation: "fadeInUp 0.4s ease-out" }}
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-4">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Ошибка загрузки документов</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Список документов сейчас недоступен. Попробуйте обновить страницу или повторить позже.
          </p>
          <Button onClick={() => void refreshDocuments()} className="gap-2">
            Обновить список
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          style={{ animation: "fadeInUp 0.4s ease-out" }}
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-4">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Нет документов</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Создайте первый документ, чтобы он появился в поиске
          </p>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Создать документ
          </Button>
        </div>
      ) : (
        <div
          className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
          style={{ animation: "fadeInUp 0.35s ease-out" }}
        >
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium">Название</TableHead>
                <TableHead className="font-medium hidden sm:table-cell w-[110px]">Создан</TableHead>
                <TableHead className="font-medium hidden md:table-cell w-[110px]">Обновлен</TableHead>
                <TableHead className="font-medium text-right w-[84px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id} className="group">
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground line-clamp-1">{doc.title}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1 sm:hidden">
                        {formatDate(doc.updatedAt)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground hidden sm:table-cell">
                    {formatDate(doc.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground hidden md:table-cell">
                    {formatDate(doc.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right w-[84px]">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        onClick={() => handleEdit(doc)}
                        aria-label={`Редактировать ${doc.title}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(doc)}
                        aria-label={`Удалить ${doc.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DocumentFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditingDoc(null)
        }}
        document={editingDoc}
        onSubmit={handleFormSubmit}
      />

      <DeleteDocumentDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        documentTitle={deleteTarget?.title ?? ""}
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}
