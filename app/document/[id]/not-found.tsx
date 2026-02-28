import Link from "next/link"
import { Header } from "@/components/header"
import { FileX } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary mb-6 mx-auto">
            <FileX className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Документ не найден
          </h2>
          <p className="text-muted-foreground text-sm mb-8 max-w-sm leading-relaxed">
            Запрашиваемый документ не существует или был удален.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
          >
            Вернуться к поиску
          </Link>
        </div>
      </main>
    </div>
  )
}
