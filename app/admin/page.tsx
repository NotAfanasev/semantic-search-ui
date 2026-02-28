"use client"

import { useState, useCallback } from "react"
import type { Document, DocumentFormData } from "@/lib/types"
import {
  getAllDocuments,
  addDocument,
  updateDocument,
  deleteDocument,
} from "@/lib/mock-data"
import { Header } from "@/components/header"
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
import { Plus, Pencil, Trash2, FileText } from "lucide-react"
import { toast } from "sonner"

export default function AdminPage() {
  const [documents, setDocuments] = useState<Document[]>(getAllDocuments)
  const [formOpen, setFormOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)

  const refreshDocuments = useCallback(() => {
    setDocuments(getAllDocuments())
  }, [])

  function handleCreate() {
    setEditingDoc(null)
    setFormOpen(true)
  }

  function handleEdit(doc: Document) {
    setEditingDoc(doc)
    setFormOpen(true)
  }

  function handleFormSubmit(data: DocumentFormData) {
    if (editingDoc) {
      const updated = updateDocument(editingDoc.id, data)
      if (updated) {
        toast.success("Документ обновлен", {
          description: updated.title,
        })
      }
    } else {
      const created = addDocument(data)
      toast.success("Документ создан", {
        description: created.title,
      })
    }
    refreshDocuments()
    setFormOpen(false)
    setEditingDoc(null)
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const success = deleteDocument(deleteTarget.id)
    if (success) {
      toast.success("Документ удален", {
        description: deleteTarget.title,
      })
    }
    refreshDocuments()
    setDeleteTarget(null)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-[900px] mx-auto px-6 py-8">
        {/* Title bar */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-foreground tracking-tight text-balance">
              Управление документами
            </h1>
            <p className="text-sm text-muted-foreground">
              Создавайте, редактируйте и удаляйте документы базы знаний
            </p>
          </div>
          <Button onClick={handleCreate} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Добавить</span>
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mb-6">
          <Badge variant="secondary" className="text-sm px-3 py-1 font-normal">
            {documents.length}{" "}
            {documents.length === 1
              ? "документ"
              : documents.length < 5
                ? "документа"
                : "документов"}
          </Badge>
        </div>

        {/* Table or empty state */}
        {documents.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-center"
            style={{ animation: "fadeInUp 0.4s ease-out" }}
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              Нет документов
            </h3>
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
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-medium">Название</TableHead>
                  <TableHead className="font-medium hidden sm:table-cell w-[120px]">
                    Создан
                  </TableHead>
                  <TableHead className="font-medium hidden md:table-cell w-[120px]">
                    Обновлен
                  </TableHead>
                  <TableHead className="font-medium text-right w-[100px]">
                    Действия
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id} className="group">
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground line-clamp-1">
                          {doc.title}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-1 sm:hidden">
                          {formatDate(doc.updatedAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                      {formatDate(doc.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {formatDate(doc.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          onClick={() => handleEdit(doc)}
                          aria-label={`Редактировать ${doc.title}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
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
      </main>

      {/* Dialogs */}
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
    </div>
  )
}
