import { Search, AlertCircle, FileX } from "lucide-react"

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary mb-6">
        <Search className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Введите запрос
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
        Начните поиск по базе знаний компании. Введите ваш вопрос, и система найдет наиболее релевантные документы.
      </p>
    </div>
  )
}

export function NoResultsState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary mb-6">
        <FileX className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Ничего не найдено
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
        Попробуйте переформулировать запрос или использовать другие ключевые слова.
      </p>
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-6">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Произошла ошибка
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm leading-relaxed mb-6">
        Не удалось выполнить поиск. Проверьте соединение и попробуйте снова.
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
      >
        Попробовать снова
      </button>
    </div>
  )
}
