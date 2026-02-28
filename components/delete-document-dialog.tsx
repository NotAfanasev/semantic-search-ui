"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DeleteDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentTitle: string
  onConfirm: () => void
}

export function DeleteDocumentDialog({
  open,
  onOpenChange,
  documentTitle,
  onConfirm,
}: DeleteDocumentDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
          <AlertDialogDescription>
            Документ{" "}
            <span className="font-medium text-foreground">
              {`"${documentTitle}"`}
            </span>{" "}
            будет удален без возможности восстановления.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
