"use client"

import { useEffect, useState } from "react"
import type { Document, DocumentFormData } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"

interface DocumentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document?: Document | null
  onSubmit: (data: DocumentFormData) => void | Promise<void>
}

export function DocumentFormDialog({
  open,
  onOpenChange,
  document,
  onSubmit,
}: DocumentFormDialogProps) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({})

  const isEditing = !!document

  useEffect(() => {
    if (!open) return
    setTitle(document?.title ?? "")
    setContent(document?.content ?? "")
    setErrors({})
  }, [open, document])

  function validate(): boolean {
    const nextErrors: { title?: string; content?: string } = {}

    if (!title.trim()) {
      nextErrors.title = "Введите название"
    } else if (title.trim().length < 3) {
      nextErrors.title = "Минимум 3 символа"
    }

    if (!content.trim()) {
      nextErrors.content = "Введите содержание"
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!validate()) return
    await onSubmit({ title: title.trim(), content: content.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle className="text-lg font-semibold">
            {isEditing ? "Редактировать документ" : "Новый документ"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <ScrollArea className="max-h-[calc(90vh-11rem)] px-6">
            <div className="flex flex-col gap-5 pb-6 pt-2 pr-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="doc-title" className="text-sm font-medium">
                  Название
                </Label>
                <Input
                  id="doc-title"
                  placeholder="Введите название документа..."
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value)
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
                  }}
                  className={errors.title ? "border-destructive" : ""}
                  autoFocus
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="doc-content" className="text-sm font-medium">
                  Содержание
                </Label>
                <Textarea
                  id="doc-content"
                  placeholder="Введите содержание документа..."
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value)
                    if (errors.content) setErrors((prev) => ({ ...prev, content: undefined }))
                  }}
                  className={`min-h-[220px] max-h-[50vh] resize-y overflow-y-auto [overflow-wrap:anywhere] ${errors.content ? "border-destructive" : ""}`}
                  style={{ fieldSizing: "fixed" }}
                />
                {errors.content && <p className="text-sm text-destructive">{errors.content}</p>}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit">{isEditing ? "Сохранить" : "Создать"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
