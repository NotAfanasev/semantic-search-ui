import { Header } from "@/components/header"
import { AdminLogin } from "@/components/admin-login"
import { AdminPageClient } from "@/components/admin-page-client"
import { isAdminAuthenticated, isAdminPasswordConfigured } from "@/lib/admin-auth"

export default async function AdminPage() {
  const configured = isAdminPasswordConfigured()
  const authenticated = configured ? await isAdminAuthenticated() : false

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-[900px] mx-auto px-6 py-8">
        {authenticated ? (
          <AdminPageClient />
        ) : (
          <AdminLogin configured={configured} />
        )}
      </main>
    </div>
  )
}
