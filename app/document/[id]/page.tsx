import { getDocument } from "@/lib/api"
import { Header } from "@/components/header"
import { DocumentContent } from "@/components/document-content"
import { notFound } from "next/navigation"

interface DocumentPageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params
  const document = await getDocument(id)

  if (!document) {
    notFound()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-[900px] mx-auto px-6 py-10">
        <DocumentContent document={document} />
      </main>
    </div>
  )
}
