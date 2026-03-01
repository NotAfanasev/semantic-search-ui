from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from e5_search import (
    create_document_core,
    delete_document_core,
    get_document_core,
    list_documents_core,
    search_core,
    update_document_core,
)

app = FastAPI(title="E5 Semantic Search API")


class SearchRequest(BaseModel):
    query: str


class DocumentUpsertRequest(BaseModel):
    title: str
    text: str
    department: str = "general"
    access_level: str = "internal"


@app.post("/search")
def search_endpoint(req: SearchRequest):
    results = search_core(req.query)
    return {"query": req.query, "results": results}


@app.get("/documents/{doc_id}")
def get_document_endpoint(doc_id: str):
    doc = get_document_core(doc_id)
    if doc is None:
        return {"found": False, "doc_id": doc_id}
    return {"found": True, "document": doc}


@app.get("/documents")
def list_documents_endpoint():
    return {"documents": list_documents_core()}


@app.post("/documents")
def create_document_endpoint(req: DocumentUpsertRequest):
    try:
        doc = create_document_core(
            title=req.title,
            text=req.text,
            department=req.department,
            access_level=req.access_level,
        )
        return {"created": True, "document": doc}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/documents/{doc_id}")
def update_document_endpoint(doc_id: str, req: DocumentUpsertRequest):
    try:
        doc = update_document_core(
            doc_id=doc_id,
            title=req.title,
            text=req.text,
            department=req.department,
            access_level=req.access_level,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"updated": True, "document": doc}


@app.delete("/documents/{doc_id}")
def delete_document_endpoint(doc_id: str):
    deleted = delete_document_core(doc_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": True, "doc_id": doc_id}
