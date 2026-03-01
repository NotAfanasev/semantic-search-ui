"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, Settings, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export function Header() {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith("/admin")

  return (
    <header className="w-full border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-[900px] mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <BookOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold text-foreground tracking-tight">
            База знаний
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              !isAdmin
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Поиск</span>
          </Link>
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isAdmin
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Администрирование</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
