"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Shield } from "lucide-react"
import { loginAdmin } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface AdminLoginProps {
  configured: boolean
}

export function AdminLogin({ configured }: AdminLoginProps) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!configured) return

    setSubmitting(true)
    try {
      await loginAdmin(password)
      router.refresh()
    } catch {
      toast.error("Неверный пароль администратора")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-20">
      <div className="rounded-2xl border border-border bg-card shadow-sm p-8">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-secondary mb-5">
          <Shield className="h-5 w-5 text-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">
          Доступ к администрированию
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Введите пароль администратора, чтобы управлять базой знаний.
        </p>

        {configured ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Пароль"
              disabled={submitting}
            />
            <Button type="submit" className="w-full" disabled={submitting || !password.trim()}>
              {submitting ? "Вход..." : "Войти"}
            </Button>
          </form>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 p-4 text-sm">
            Переменная `ADMIN_PASSWORD` не настроена. Администрирование заблокировано до настройки
            секрета на сервере.
          </div>
        )}
      </div>
    </div>
  )
}
