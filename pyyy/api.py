import logging
import os
import threading

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from e5_search import (
    create_document_core,
    delete_document_core,
    get_document_core,
    init_search,
    list_documents_core,
    search_core,
    update_document_core,
)

app = FastAPI(title="E5 Semantic Search API")
logger = logging.getLogger(__name__)
_warmup_started = False
_warmup_lock = threading.Lock()
ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN", "").strip()


def _warmup_search_state() -> None:
    try:
        init_search()
    except Exception:
        logger.exception("Background search warmup failed")


@app.on_event("startup")
def start_background_warmup():
    global _warmup_started
    with _warmup_lock:
        if _warmup_started:
            return
        threading.Thread(
            target=_warmup_search_state,
            name="search-warmup",
            daemon=True,
        ).start()
        _warmup_started = True


class SearchRequest(BaseModel):
    query: str


class DocumentUpsertRequest(BaseModel):
    title: str
    text: str
    department: str = "general"
    access_level: str = "internal"


def _require_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    if not ADMIN_API_TOKEN:
        raise HTTPException(status_code=503, detail="Admin API token is not configured")
    if x_admin_token != ADMIN_API_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.post("/search")
def search_endpoint(req: SearchRequest):
    results = search_core(req.query)
    return {"query": req.query, "results": results}


@app.get("/health")
def health_endpoint():
    return {"ok": True}


@app.get("/documents/{doc_id}")
def get_document_endpoint(doc_id: str):
    doc = get_document_core(doc_id)
    if doc is None:
        return {"found": False, "doc_id": doc_id}
    return {"found": True, "document": doc}


@app.get("/documents")
def list_documents_endpoint(x_admin_token: str | None = Header(default=None)):
    _require_admin_token(x_admin_token)
    return {"documents": list_documents_core()}


@app.post("/documents")
def create_document_endpoint(
    req: DocumentUpsertRequest, x_admin_token: str | None = Header(default=None)
):
    _require_admin_token(x_admin_token)
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
def update_document_endpoint(
    doc_id: str, req: DocumentUpsertRequest, x_admin_token: str | None = Header(default=None)
):
    _require_admin_token(x_admin_token)
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
def delete_document_endpoint(doc_id: str, x_admin_token: str | None = Header(default=None)):
    _require_admin_token(x_admin_token)
    deleted = delete_document_core(doc_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": True, "doc_id": doc_id}
