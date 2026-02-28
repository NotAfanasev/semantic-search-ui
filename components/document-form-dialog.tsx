"use client"

import { useState, useEffect } from "react"
import type { Document, DocumentFormData } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface DocumentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document?: Document | null
  onSubmit: (data: DocumentFormData) => void
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
    if (open) {
      setTitle(document?.title ?? "")
      setContent(document?.content ?? "")
      setErrors({})
    }
  }, [open, document])

  function validate(): boolean {
    const newErrors: { title?: string; content?: string } = {}
    if (!title.trim()) {
      newErrors.title = "Введите название"
    } else if (title.trim().length < 3) {
      newErrors.title = "Минимум 3 символа"
    }
    if (!content.trim()) {
      newErrors.content = "Введите содержание"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({ title: title.trim(), content: content.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEditing ? "Редактировать документ" : "Новый документ"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="doc-title" className="text-sm font-medium">
              Название
            </Label>
            <Input
              id="doc-title"
              placeholder="Введите название документа..."
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
              }}
              className={errors.title ? "border-destructive" : ""}
              autoFocus
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="doc-content" className="text-sm font-medium">
              Содержание
            </Label>
            <Textarea
              id="doc-content"
              placeholder="Введите содержание документа..."
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (errors.content)
                  setErrors((prev) => ({ ...prev, content: undefined }))
              }}
              className={`min-h-[200px] resize-y ${errors.content ? "border-destructive" : ""}`}
            />
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit">
              {isEditing ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
