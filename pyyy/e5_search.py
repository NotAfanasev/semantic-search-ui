import hashlib
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

import db


MODEL_NAME = os.getenv("EMBEDDING_MODEL", "intfloat/multilingual-e5-base")

TOP_CHUNKS = int(os.getenv("TOP_CHUNKS", "80"))
TOP_RESULTS = int(os.getenv("TOP_RESULTS", "3"))
MAX_CHUNKS_PER_DOC = int(os.getenv("MAX_CHUNKS_PER_DOC", "2"))
MIN_SCORE = float(os.getenv("MIN_SCORE", "0.30"))

QUERY_PREFIX = "query: "
PASSAGE_PREFIX = "passage: "
CHUNK_SIZE = int(os.getenv("DOC_CHUNK_SIZE", "900"))

CSV_CANDIDATES = [
    "data/docs.csv",
    "../incoming/docs.csv",
    "docs.csv",
]


@dataclass
class SearchState:
    model: SentenceTransformer
    df: pd.DataFrame
    passage_embs: np.ndarray
    csv_path: str


_STATE: Optional[SearchState] = None


def _model_slug() -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", MODEL_NAME)


def _today_iso() -> str:
    return time.strftime("%Y-%m-%d")


def normalize_text(value: Any) -> str:
    return " ".join(str(value).split())


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and np.isnan(value):
        return ""
    text = str(value).strip()
    if text.lower() in {"nan", "none", "null"}:
        return ""
    return text


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename_map: Dict[str, str] = {}
    for col in df.columns:
        normalized = re.sub(r"\s+", " ", str(col)).strip().lower().replace(" ", "_")
        rename_map[str(col)] = normalized
    df = df.rename(columns=rename_map)

    aliases = [
        ("content", "text"),
        ("passage", "text"),
    ]
    for src, dst in aliases:
        if src in df.columns and dst not in df.columns:
            df[dst] = df[src]
    return df


def _ensure_admin_columns(df: pd.DataFrame) -> pd.DataFrame:
    for col, default in [
        ("doc_id", ""),
        ("chunk_id", ""),
        ("title", ""),
        ("department", "general"),
        ("access_level", "internal"),
        ("text", ""),
        ("created_at", ""),
        ("updated_at", ""),
    ]:
        if col not in df.columns:
            df[col] = default

    df = df.fillna("").copy()
    for col in ("doc_id", "chunk_id", "title", "department", "access_level", "text"):
        df[col] = df[col].astype(str)

    df["title"] = df["title"].map(normalize_text)
    df["text"] = df["text"].map(normalize_text)

    # Keep best-effort dedupe to avoid noisy duplicate hits.
    if "chunk_id" in df.columns:
        df = df.drop_duplicates(subset=["chunk_id"], keep="first")
    df = df.drop_duplicates(subset=["doc_id", "title", "text"], keep="first")

    # Stable order keeps embeddings/index deterministic.
    if "chunk_id" in df.columns:
        df = df.sort_values(by=["doc_id", "chunk_id"], kind="stable")
    else:
        df = df.sort_values(by=["doc_id"], kind="stable")

    return df.reset_index(drop=True)


def pick_csv_path() -> str:
    base = Path(__file__).resolve().parent
    for rel in CSV_CANDIDATES:
        candidate = (base / rel).resolve()
        if candidate.exists():
            return str(candidate)

    tried = "\n".join(str((base / rel).resolve()) for rel in CSV_CANDIDATES)
    raise FileNotFoundError(
        f"docs.csv was not found. Tried:\n{tried}\n\n"
        "Place docs.csv next to e5_search.py or under data/."
    )


def wrap_query(query: str) -> str:
    return f"Вопрос сотрудника компании: {query}. Найди инструкцию или регламент, что делать."


def load_docs(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df = _normalize_columns(df)
    return _ensure_admin_columns(df)


def _load_docs_state(csv_path: Optional[str] = None) -> tuple[pd.DataFrame, str]:
    if db.is_enabled():
        if not db.has_any_documents():
            seed_path = csv_path or pick_csv_path()
            db.save_docs_df(load_docs(seed_path))
        return _ensure_admin_columns(db.load_docs_df()), "database://documents"

    resolved_csv_path = csv_path or pick_csv_path()
    return load_docs(resolved_csv_path), resolved_csv_path


def _index_cache_path(csv_path: str) -> str:
    if csv_path.startswith("database://"):
        data_dir = Path(__file__).resolve().parent / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        return str(data_dir / f"documents.{_model_slug()}.embeddings.npz")

    csv_file = Path(csv_path)
    return str(csv_file.with_name(f"{csv_file.stem}.{_model_slug()}.embeddings.npz"))


def _docs_signature(df: pd.DataFrame) -> str:
    payload = df[["doc_id", "chunk_id", "title", "text"]].fillna("").astype(str)
    joined = "\n".join("||".join(row) for row in payload.itertuples(index=False, name=None))
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def _load_cached_embeddings(csv_path: str, df: pd.DataFrame) -> Optional[np.ndarray]:
    cache_path = Path(_index_cache_path(csv_path))
    if not cache_path.exists():
        return None

    try:
        with np.load(cache_path, allow_pickle=False) as cached:
            cached_signature = str(cached["signature"].item())
            expected_signature = _docs_signature(df)
            if cached_signature != expected_signature:
                return None

            embeddings = cached["embeddings"]
            if embeddings.shape[0] != len(df):
                return None
            return embeddings.astype(np.float32, copy=False)
    except Exception:
        return None


def _save_cached_embeddings(csv_path: str, df: pd.DataFrame, embeddings: np.ndarray) -> None:
    np.savez_compressed(
        _index_cache_path(csv_path),
        embeddings=np.asarray(embeddings, dtype=np.float32),
        signature=np.array(_docs_signature(df)),
    )


def _build_passages(df: pd.DataFrame) -> List[str]:
    passages: List[str] = []
    for row in df.itertuples(index=False):
        title = normalize_text(getattr(row, "title", ""))
        text = normalize_text(getattr(row, "text", ""))
        if title:
            payload = f"Заголовок: {title}\nТекст: {text}"
        else:
            payload = f"Текст: {text}"
        passages.append(PASSAGE_PREFIX + payload)
    return passages


def embed_passages(model: SentenceTransformer, passages: List[str]) -> np.ndarray:
    return model.encode(
        passages,
        batch_size=64,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    ).astype(np.float32)


def embed_query(model: SentenceTransformer, query: str) -> np.ndarray:
    clean_query = normalize_text(query)
    raw_query = QUERY_PREFIX + clean_query
    wrapped_query = QUERY_PREFIX + wrap_query(clean_query)

    # Short queries work better without heavy prompt wrapping.
    if len(clean_query.split()) <= 2:
        return model.encode(
            [raw_query],
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )[0].astype(np.float32)

    vectors = model.encode(
        [raw_query, wrapped_query],
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    ).astype(np.float32)
    mixed = (0.75 * vectors[0]) + (0.25 * vectors[1])
    norm = np.linalg.norm(mixed)
    if norm > 0:
        mixed = mixed / norm
    return mixed.astype(np.float32)


def _query_terms(query: str) -> List[str]:
    terms = re.findall(r"[0-9A-Za-zА-Яа-яЁё-]{3,}", query.lower())
    variants: List[str] = []
    seen: set[str] = set()
    for term in terms:
        for candidate in (term, term[:-1], term[:-2]):
            if len(candidate) < 3:
                continue
            if candidate in seen:
                continue
            seen.add(candidate)
            variants.append(candidate)
    return variants


def _lexical_bonus(query_terms: List[str], title: str, text: str) -> float:
    if not query_terms:
        return 0.0

    title_l = title.lower()
    text_l = text.lower()
    bonus = 0.0
    for term in query_terms:
        if term in title_l:
            bonus += 0.18
        elif term in text_l:
            bonus += 0.05
    return min(bonus, 0.30)


def search(
    query: str,
    model: SentenceTransformer,
    df: pd.DataFrame,
    passage_embs: np.ndarray,
) -> List[Dict[str, Any]]:
    clean_query = query.strip()
    if not clean_query:
        return []

    q_emb = embed_query(model, clean_query)
    sims = passage_embs @ q_emb
    if sims.size == 0:
        return []

    top_idx = np.argsort(-sims)[: min(TOP_CHUNKS, sims.size)]
    query_terms = _query_terms(clean_query)

    ranked: List[tuple[float, float, int]] = []
    for idx in top_idx:
        semantic_score = float(sims[int(idx)])
        if semantic_score < MIN_SCORE:
            continue
        row = df.iloc[int(idx)]
        title = _safe_str(row.get("title", ""))
        text = _safe_str(row.get("text", ""))
        score = semantic_score + _lexical_bonus(query_terms, title, text)
        ranked.append((score, semantic_score, int(idx)))

    ranked.sort(key=lambda item: item[0], reverse=True)

    results: List[Dict[str, Any]] = []
    per_doc_count: Dict[str, int] = {}
    for score, semantic_score, idx in ranked:
        row = df.iloc[idx]
        doc_id = _safe_str(row.get("doc_id", ""))
        if per_doc_count.get(doc_id, 0) >= MAX_CHUNKS_PER_DOC:
            continue

        results.append(
            {
                "score": semantic_score,
                "doc_id": doc_id,
                "chunk_id": _safe_str(row.get("chunk_id", "")),
                "title": _safe_str(row.get("title", "")),
                "text": _safe_str(row.get("text", "")),
            }
        )
        per_doc_count[doc_id] = per_doc_count.get(doc_id, 0) + 1
        if len(results) >= TOP_RESULTS:
            break

    return results


def init_search(force: bool = False) -> SearchState:
    global _STATE
    if _STATE is not None and not force:
        return _STATE

    df, csv_path = _load_docs_state()
    model = _STATE.model if (_STATE is not None and force) else SentenceTransformer(MODEL_NAME)

    passage_embs = _load_cached_embeddings(csv_path, df)
    if passage_embs is None:
        passages = _build_passages(df)
        passage_embs = embed_passages(model, passages)
        _save_cached_embeddings(csv_path, df, passage_embs)

    _STATE = SearchState(model=model, df=df, passage_embs=passage_embs, csv_path=csv_path)
    return _STATE


def search_core(query: str, state: Optional[SearchState] = None) -> List[Dict[str, Any]]:
    resolved_state = state or init_search()
    return search(query, resolved_state.model, resolved_state.df, resolved_state.passage_embs)


def _split_text_to_chunks(text: str, chunk_size: int = CHUNK_SIZE) -> List[str]:
    normalized = str(text).replace("\r\n", "\n").strip()
    if not normalized:
        return []

    paragraphs = [part.strip() for part in re.split(r"\n{2,}", normalized) if part.strip()]
    chunks: List[str] = []
    current = ""

    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= chunk_size:
            current = candidate
            continue

        if current:
            chunks.append(current)
            current = ""

        if len(paragraph) <= chunk_size:
            current = paragraph
            continue

        start = 0
        while start < len(paragraph):
            part = paragraph[start : start + chunk_size].strip()
            if part:
                chunks.append(part)
            start += chunk_size

    if current:
        chunks.append(current)

    return chunks


def _next_doc_id(df: pd.DataFrame) -> str:
    pattern = re.compile(r"^DOC(\d+)$")
    max_num = 0
    for raw in df.get("doc_id", pd.Series(dtype=str)).astype(str):
        match = pattern.match(raw.strip())
        if match:
            max_num = max(max_num, int(match.group(1)))
    return f"DOC{max_num + 1:04d}"


def _collect_full_text(rows: pd.DataFrame) -> str:
    ordered = rows.copy()
    if "chunk_id" in ordered.columns:
        ordered["_chunk_order"] = (
            ordered["chunk_id"]
            .astype(str)
            .str.extract(r"(\d+)$", expand=False)
            .fillna("0")
            .astype(int)
        )
        ordered = ordered.sort_values(by=["_chunk_order", "chunk_id"], kind="stable")

    parts = [normalize_text(text) for text in ordered["text"].astype(str).tolist() if normalize_text(text)]
    return "\n\n".join(parts)


def _document_from_df(doc_id: str, df: pd.DataFrame) -> Optional[Dict[str, Any]]:
    target = str(doc_id).strip()
    if not target:
        return None

    rows = df[df["doc_id"].astype(str) == target].copy()
    if rows.empty:
        return None

    first = rows.iloc[0]
    created_at = _safe_str(first.get("created_at", "")) or _today_iso()
    updated_at = _safe_str(first.get("updated_at", "")) or created_at
    title = normalize_text(first.get("title", "")) or f"Документ {target}"

    return {
        "doc_id": target,
        "title": title,
        "text": _collect_full_text(rows),
        "created_at": created_at,
        "updated_at": updated_at,
    }


def _list_documents_from_df(df: pd.DataFrame) -> List[Dict[str, Any]]:
    documents: List[Dict[str, Any]] = []
    for doc_id, group in df.groupby(df["doc_id"].astype(str), sort=True):
        if not str(doc_id).strip():
            continue
        doc = _document_from_df(str(doc_id), group)
        if doc is not None:
            documents.append(doc)
    documents.sort(key=lambda item: item["doc_id"])
    return documents


def _persist_docs(df: pd.DataFrame, csv_path: str) -> None:
    global _STATE

    cleaned = _ensure_admin_columns(df)
    cache_path = Path(_index_cache_path(csv_path))
    if cache_path.exists():
        cache_path.unlink()

    if db.is_enabled():
        db.save_docs_df(cleaned)
    else:
        cleaned.to_csv(csv_path, index=False, encoding="utf-8")

    _STATE = None


def get_document_core(doc_id: str, state: Optional[SearchState] = None) -> Optional[Dict[str, Any]]:
    df = _ensure_admin_columns(state.df.copy()) if state is not None else _load_docs_state()[0]
    return _document_from_df(doc_id, df)


def list_documents_core(state: Optional[SearchState] = None) -> List[Dict[str, Any]]:
    df = _ensure_admin_columns(state.df.copy()) if state is not None else _load_docs_state()[0]
    return _list_documents_from_df(df)


def create_document_core(
    title: str,
    text: str,
    department: str = "general",
    access_level: str = "internal",
    state: Optional[SearchState] = None,
) -> Dict[str, Any]:
    if state is None:
        df, csv_path = _load_docs_state()
    else:
        df = _ensure_admin_columns(state.df.copy())
        csv_path = state.csv_path

    clean_title = normalize_text(title)
    if len(clean_title) < 3:
        raise ValueError("Title must be at least 3 characters long.")

    chunks = _split_text_to_chunks(text)
    if not chunks:
        raise ValueError("Document content is empty.")

    doc_id = _next_doc_id(df)
    today = _today_iso()

    rows = []
    for index, chunk in enumerate(chunks, start=1):
        rows.append(
            {
                "doc_id": doc_id,
                "chunk_id": f"{doc_id}_C{index:02d}",
                "title": clean_title,
                "department": department,
                "access_level": access_level,
                "text": chunk,
                "created_at": today,
                "updated_at": today,
            }
        )

    updated_df = pd.concat([df, pd.DataFrame(rows)], ignore_index=True)
    _persist_docs(updated_df, csv_path)

    doc = _document_from_df(doc_id, updated_df)
    if doc is None:
        raise RuntimeError("Failed to load created document.")
    return doc


def update_document_core(
    doc_id: str,
    title: str,
    text: str,
    department: Optional[str] = None,
    access_level: Optional[str] = None,
    state: Optional[SearchState] = None,
) -> Optional[Dict[str, Any]]:
    target = str(doc_id).strip()
    if not target:
        return None

    if state is None:
        df, csv_path = _load_docs_state()
    else:
        df = _ensure_admin_columns(state.df.copy())
        csv_path = state.csv_path

    clean_title = normalize_text(title)
    if len(clean_title) < 3:
        raise ValueError("Title must be at least 3 characters long.")

    chunks = _split_text_to_chunks(text)
    if not chunks:
        raise ValueError("Document content is empty.")

    mask = df["doc_id"].astype(str) == target
    if not mask.any():
        return None

    existing = df[mask].iloc[0]
    resolved_department = department or _safe_str(existing.get("department", "")) or "general"
    resolved_access = access_level or _safe_str(existing.get("access_level", "")) or "internal"
    created_at = _safe_str(existing.get("created_at", "")) or _today_iso()
    updated_at = _today_iso()

    kept = df[~mask].copy()
    rows = []
    for index, chunk in enumerate(chunks, start=1):
        rows.append(
            {
                "doc_id": target,
                "chunk_id": f"{target}_C{index:02d}",
                "title": clean_title,
                "department": resolved_department,
                "access_level": resolved_access,
                "text": chunk,
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )

    updated_df = pd.concat([kept, pd.DataFrame(rows)], ignore_index=True)
    _persist_docs(updated_df, csv_path)
    return _document_from_df(target, updated_df)


def delete_document_core(doc_id: str, state: Optional[SearchState] = None) -> bool:
    target = str(doc_id).strip()
    if not target:
        return False

    if state is None:
        df, csv_path = _load_docs_state()
    else:
        df = _ensure_admin_columns(state.df.copy())
        csv_path = state.csv_path

    mask = df["doc_id"].astype(str) == target
    if not mask.any():
        return False

    updated_df = df[~mask].copy()
    _persist_docs(updated_df, csv_path)
    return True


def main() -> None:
    state = init_search()
    print(f"E5 semantic search ready. model={MODEL_NAME}, docs={state.csv_path}")
    print("Press Enter on an empty query to exit.")

    while True:
        try:
            query = input("\nQuery> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not query:
            break

        started_at = time.time()
        results = search_core(query, state)
        elapsed = time.time() - started_at

        if not results:
            print("No relevant results found.")
            continue

        for index, result in enumerate(results, start=1):
            snippet = normalize_text(result.get("text", ""))[:220]
            print(
                f"{index}. score={result['score']:.3f} | "
                f"doc={result.get('doc_id')} chunk={result.get('chunk_id')} | "
                f"{result.get('title')}"
            )
            print(snippet)
            print("-" * 60)
        print(f"Done in {elapsed:.3f}s")


if __name__ == "__main__":
    main()
