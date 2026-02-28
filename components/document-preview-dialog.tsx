"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { getSearchDocumentById, type SearchDocumentPreview } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface DocumentPreviewDialogProps {
  docId: string
}

export function DocumentPreviewDialog({ docId }: DocumentPreviewDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [document, setDocument] = useState<SearchDocumentPreview | null>(null)

  async function openDialog() {
    setOpen(true)
    setLoading(true)
    setError(null)

    try {
      const data = await getSearchDocumentById(docId)
      if (!data) {
        setError("Документ не найден")
        setDocument(null)
        return
      }
      setDocument(data)
    } catch {
      setError("Не удалось загрузить документ")
      setDocument(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground transition-all duration-200 hover:bg-secondary hover:border-foreground/10 hover:scale-[1.02] active:scale-[0.98]"
      >
        Открыть
        <ArrowRight className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Документ</DialogTitle>
          </DialogHeader>

          {loading && (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          )}

          {!loading && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {!loading && !error && document && (
            <div className="flex flex-col gap-5 pt-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="preview-title" className="text-sm font-medium">
                  Название
                </Label>
                <Input id="preview-title" value={document.title} readOnly />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="preview-content" className="text-sm font-medium">
                  Содержание
                </Label>
                <Textarea
                  id="preview-content"
                  value={document.content}
                  readOnly
                  className="min-h-[320px] resize-y"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
