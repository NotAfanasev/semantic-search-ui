import os
import time
import re
from pathlib import Path
from typing import List, Dict, Any

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich import box
except ImportError:
    Console = None
    Table = None
    Panel = None
    Text = None
    box = None


# =====================
# CONFIG
# =====================
MODEL_NAME = os.getenv("EMBEDDING_MODEL", "intfloat/multilingual-e5-small")

TOP_CHUNKS = 80
TOP_RESULTS = 3
MAX_CHUNKS_PER_DOC = 1
MIN_SCORE = 0.30

USE_DEPT_ROUTING = False  # оставил как было

QUERY_PREFIX = "query: "
PASSAGE_PREFIX = "passage: "

# Пути: пробуем несколько вариантов, чтобы не ловить FileNotFoundError
CSV_CANDIDATES = [
    "data/docs.csv"
    ]


# =====================
# Console helpers
# =====================
console = Console() if Console is not None else None
from dataclasses import dataclass
from typing import Optional


def console_print(*args: Any) -> None:
    if console is not None:
        console.print(*args)
        return

    plain_parts = [re.sub(r"\[[^\]]+\]", "", str(arg)) for arg in args]
    print(*plain_parts)

@dataclass
class SearchState:
    model: SentenceTransformer
    df: pd.DataFrame
    passage_embs: np.ndarray
    csv_path: str

_STATE: Optional[SearchState] = None
CHUNK_SIZE = 900

def clear_screen() -> None:
    # Windows + Git Bash тоже ок
    os.system("cls" if os.name == "nt" else "clear")


def pick_csv_path() -> str:
    base = Path(__file__).resolve().parent
    for rel in CSV_CANDIDATES:
        p = (base / rel).resolve()
        if p.exists():
            return str(p)
    # если не нашли — покажем человеку, что ожидали
    tried = "\n".join([str((base / rel).resolve()) for rel in CSV_CANDIDATES])
    raise FileNotFoundError(
        f"docs.csv не найден. Я пробовал пути:\n{tried}\n\n"
        f"Положи docs.csv рядом с e5_search.py или в папку data/ (data/docs.csv)."
    )


def wrap_query(q: str) -> str:
    # можно менять формулировку промпта
    return f"Вопрос сотрудника компании: {q}. Найди инструкцию или регламент, что делать."


def normalize_text(s: str) -> str:
    return " ".join(str(s).split())


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and np.isnan(value):
        return ""
    text = str(value).strip()
    if text.lower() in {"nan", "none", "null"}:
        return ""
    return text


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _split_text_to_chunks(text: str, chunk_size: int = CHUNK_SIZE) -> List[str]:
    normalized = str(text).replace("\r\n", "\n").strip()
    if not normalized:
        return []

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", normalized) if p.strip()]
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
    return df


def _today_iso() -> str:
    return time.strftime("%Y-%m-%d")


def _load_docs_state(csv_path: Optional[str] = None) -> tuple[pd.DataFrame, str]:
    resolved_csv_path = csv_path or pick_csv_path()
    return _ensure_admin_columns(load_docs(resolved_csv_path)), resolved_csv_path


def _persist_docs(df: pd.DataFrame, csv_path: str) -> None:
    global _STATE
    cleaned = df.fillna("").copy()
    cleaned.to_csv(csv_path, index=False, encoding="utf-8")
    # Invalidate semantic cache and rebuild lazily on the next search request.
    _STATE = None


def _collect_full_text(rows: pd.DataFrame) -> str:
    sorted_rows = rows.copy()
    if "chunk_id" in sorted_rows.columns:
        sorted_rows["_chunk_order"] = (
            sorted_rows["chunk_id"]
            .astype(str)
            .str.extract(r"(\d+)$", expand=False)
            .fillna("0")
            .astype(int)
        )
        sorted_rows = sorted_rows.sort_values(by=["_chunk_order", "chunk_id"], kind="stable")

    parts = [
        normalize_text(text)
        for text in sorted_rows["text"].astype(str).tolist()
        if normalize_text(text)
    ]
    return "\n\n".join(parts)


def _document_from_df(doc_id: str, df: pd.DataFrame) -> Optional[Dict[str, Any]]:
    target = str(doc_id).strip()
    if not target:
        return None

    doc_rows = df[df["doc_id"].astype(str) == target].copy()
    if doc_rows.empty:
        return None

    full_text = _collect_full_text(doc_rows)
    first_row = doc_rows.iloc[0]
    title = normalize_text(first_row.get("title", "")) or f"Р”РѕРєСѓРјРµРЅС‚ {target}"
    created_at = _safe_str(first_row.get("created_at", "")) or _today_iso()
    updated_at = _safe_str(first_row.get("updated_at", "")) or created_at

    return {
        "doc_id": target,
        "title": title,
        "text": full_text,
        "created_at": created_at,
        "updated_at": updated_at,
    }


def _list_documents_from_df(df: pd.DataFrame) -> List[Dict[str, Any]]:
    documents: List[Dict[str, Any]] = []

    for doc_id, group in df.groupby(df["doc_id"].astype(str), sort=True):
        if not str(doc_id).strip():
            continue
        first_row = group.iloc[0]
        title = normalize_text(_safe_str(first_row.get("title", ""))) or f"Р”РѕРєСѓРјРµРЅС‚ {doc_id}"
        created_at = _safe_str(first_row.get("created_at", "")) or _today_iso()
        updated_at = _safe_str(first_row.get("updated_at", "")) or created_at
        documents.append(
            {
                "doc_id": str(doc_id),
                "title": title,
                "text": _collect_full_text(group),
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )

    documents.sort(key=lambda item: item["doc_id"])
    return documents


def print_header(model_name: str, csv_path: str) -> None:
    if console is None or Text is None or Panel is None:
        print("E5 Semantic Search (console)")
        print(f"Model: {model_name}")
        print(f"CSV: {csv_path}")
        print("Commands: help, clear, exit")
        return

    title = Text("E5 Semantic Search (console)", style="bold")
    info = Text.assemble(
        ("Model: ", "bold"),
        (model_name, "cyan"),
        ("\nCSV: ", "bold"),
        (csv_path, "green"),
        ("\n\nКоманды: ", "bold"),
        ("help", "yellow"), (", ", "dim"),
        ("clear", "yellow"), (", ", "dim"),
        ("exit", "yellow"),
    )
    console.print(Panel(info, title=title, border_style="bright_blue"))


def print_help() -> None:
    if console is None or Panel is None:
        print("Как пользоваться")
        print("- Вводишь запрос и получаешь лучшие совпадения.")
        print("- Пустой ввод не выполняет поиск.")
        print("Команды: help, clear, exit")
        return

    msg = """
[bold]Как пользоваться[/bold]
• Вводишь запрос — получаешь TOP_RESULTS лучших совпадений.
• Пустой ввод = выход.

[bold]Команды[/bold]
• [yellow]help[/yellow]  — показать подсказку
• [yellow]clear[/yellow] — очистить экран
• [yellow]exit[/yellow]  — выйти

[bold]Совет[/bold]
Если запросы короткие, попробуй уточнять: "как оформить отпуск", "как заказать справку", "проблемы с доступом в VPN" и т.д.
"""
    console.print(Panel(msg.strip(), title="Help", border_style="magenta"))


def results_table(results: List[Dict[str, Any]], elapsed: float):
    if Table is None or box is None:
        return results

    table = Table(
        title=f"Результаты (за {elapsed:.2f} сек)",
        box=box.SIMPLE_HEAVY,
        show_lines=True,
        header_style="bold",
    )
    table.add_column("#", style="dim", width=3, justify="right")
    table.add_column("Score", width=7, justify="right")
    table.add_column("Doc", width=10)
    table.add_column("Chunk", width=10)
    table.add_column("Title", overflow="fold")
    table.add_column("Text", overflow="fold")

    for i, r in enumerate(results, 1):
        score = r["score"]
        score_style = "green" if score >= 0.80 else "yellow" if score >= 0.60 else "red"
        table.add_row(
            str(i),
            f"[{score_style}]{score:.4f}[/{score_style}]",
            str(r.get("doc_id", "")),
            str(r.get("chunk_id", "")),
            normalize_text(r.get("title", "")),
            normalize_text(r.get("text", "")),
        )
    return table


# =====================
# Core (упрощённо)
# Предполагаем, что docs.csv содержит хотя бы:
# doc_id, chunk_id, title, text
# (если названия другие — скажи, подстрою)
# =====================
def load_docs(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip()
    # Нормализуем частые названия колонок (на всякий)
    rename_map = {}
    cols = set(df.columns.str.lower())
    # возможные варианты
    if "passage" in cols and "text" not in cols:
        rename_map[df.columns[list(cols).index("passage")]] = "text"
    df = df.rename(columns=rename_map)

    # минимальные проверки
    if "text" not in df.columns:
        raise ValueError("В docs.csv нет колонки 'text'. Покажи заголовки CSV — подстрою.")
    # если нет title/doc_id/chunk_id — добавим пустые, чтобы вывод не ломался
    for c in ["title", "doc_id", "chunk_id"]:
        if c not in df.columns:
            df[c] = ""
    return df


def embed_passages(model: SentenceTransformer, passages: List[str]) -> np.ndarray:
    # SentenceTransformers сам батчит
    embs = model.encode(
        passages,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=True,
    )
    return embs


def embed_query(model: SentenceTransformer, query: str) -> np.ndarray:
    q = wrap_query(query)
    q_emb = model.encode([QUERY_PREFIX + q], convert_to_numpy=True, normalize_embeddings=True)[0]
    return q_emb


def search(
    query: str,
    model: SentenceTransformer,
    df: pd.DataFrame,
    passage_embs: np.ndarray,
) -> List[Dict[str, Any]]:
    q_emb = embed_query(model, query)

    # cosine similarity = dot product (если normalize_embeddings=True)
    sims = passage_embs @ q_emb

    # берём TOP_CHUNKS кандидатов
    top_idx = np.argsort(-sims)[:TOP_CHUNKS]

    # ограничение MAX_CHUNKS_PER_DOC
    results = []
    per_doc = {}

    for idx in top_idx:
        score = float(sims[idx])
        if score < MIN_SCORE:
            continue

        row = df.iloc[int(idx)]
        doc_id = str(row.get("doc_id", ""))
        per_doc.setdefault(doc_id, 0)
        if per_doc[doc_id] >= MAX_CHUNKS_PER_DOC:
            continue

        per_doc[doc_id] += 1
        results.append(
            {
                "score": score,
                "doc_id": row.get("doc_id", ""),
                "chunk_id": row.get("chunk_id", ""),
                "title": row.get("title", ""),
                "text": row.get("text", ""),
            }
        )
        if len(results) >= TOP_RESULTS:
            break

    return results

def init_search(force: bool = False) -> SearchState:
    """
    Грузит модель + документы + эмбеддинги ровно 1 раз.
    Возвращает SearchState (кэш).
    """
    global _STATE
    if _STATE is not None and not force:
        return _STATE

    csv_path = pick_csv_path()

    console_print("[bold]Loading model:[/bold]", MODEL_NAME)
    model = _STATE.model if (_STATE is not None and force) else SentenceTransformer(MODEL_NAME)
    console_print("[green]Model loaded.[/green]\n")

    console_print("[bold]Loading docs:[/bold]", csv_path)
    df = load_docs(csv_path)

    passages = [PASSAGE_PREFIX + normalize_text(t) for t in df["text"].astype(str).tolist()]
    console_print(f"[green]Loaded {len(passages)} passages.[/green]\n")

    console_print("[bold]Embedding passages (1 раз):[/bold]")
    passage_embs = embed_passages(model, passages)
    console_print("[green]Embeddings ready.[/green]\n")

    _STATE = SearchState(model=model, df=df, passage_embs=passage_embs, csv_path=csv_path)
    return _STATE

def search_core(query: str, state: Optional[SearchState] = None) -> List[Dict[str, Any]]:
    """
    Универсальная функция поиска: работает и для консоли, и для API.
    """
    if state is None:
        state = init_search()
    return search(query, state.model, state.df, state.passage_embs)


def get_document_core(doc_id: str, state: Optional[SearchState] = None) -> Optional[Dict[str, Any]]:
    """
    Возвращает полный документ, собранный из всех его чанков.
    """
    if state is None:
        df, _ = _load_docs_state()
    else:
        df = _ensure_admin_columns(state.df.copy())

    target = str(doc_id).strip()
    if not target:
        return None

    df = df if state is None else state.df.copy()
    doc_rows = df[df["doc_id"].astype(str) == target].copy()
    if doc_rows.empty:
        return None

    full_text = _collect_full_text(doc_rows)

    first_row = doc_rows.iloc[0]
    title = normalize_text(first_row.get("title", "")) or f"Документ {target}"
    created_at = _safe_str(first_row.get("created_at", "")) or _today_iso()
    updated_at = _safe_str(first_row.get("updated_at", "")) or created_at

    return {
        "doc_id": target,
        "title": title,
        "text": full_text,
        "created_at": created_at,
        "updated_at": updated_at,
    }


def list_documents_core(state: Optional[SearchState] = None) -> List[Dict[str, Any]]:
    if state is None:
        df, _ = _load_docs_state()
    else:
        df = _ensure_admin_columns(state.df.copy())

    df = df if state is None else _ensure_admin_columns(state.df.copy())
    documents: List[Dict[str, Any]] = []

    for doc_id, group in df.groupby(df["doc_id"].astype(str), sort=True):
        if not str(doc_id).strip():
            continue
        first_row = group.iloc[0]
        title = normalize_text(_safe_str(first_row.get("title", ""))) or f"Документ {doc_id}"
        created_at = _safe_str(first_row.get("created_at", "")) or _today_iso()
        updated_at = _safe_str(first_row.get("updated_at", "")) or created_at
        documents.append(
            {
                "doc_id": str(doc_id),
                "title": title,
                "text": _collect_full_text(group),
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )

    documents.sort(key=lambda item: item["doc_id"])
    return documents


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
        csv_path = state.csv_path

    clean_title = normalize_text(title)
    if len(clean_title) < 3:
        raise ValueError("Title must be at least 3 characters long.")

    chunks = _split_text_to_chunks(text)
    if not chunks:
        raise ValueError("Document content is empty.")

    df = df if state is None else _ensure_admin_columns(state.df.copy())
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
        raise RuntimeError("Failed to load created document from index.")
    return {
        "doc_id": doc_id,
        "title": doc["title"],
        "text": doc["text"],
        "created_at": today,
        "updated_at": today,
    }


def update_document_core(
    doc_id: str,
    title: str,
    text: str,
    department: Optional[str] = None,
    access_level: Optional[str] = None,
    state: Optional[SearchState] = None,
) -> Optional[Dict[str, Any]]:
    if state is None:
        df, csv_path = _load_docs_state()
    else:
        csv_path = state.csv_path

    target = str(doc_id).strip()
    if not target:
        return None

    clean_title = normalize_text(title)
    if len(clean_title) < 3:
        raise ValueError("Title must be at least 3 characters long.")

    chunks = _split_text_to_chunks(text)
    if not chunks:
        raise ValueError("Document content is empty.")

    df = df if state is None else _ensure_admin_columns(state.df.copy())
    mask = df["doc_id"].astype(str) == target
    if not mask.any():
        return None

    existing = df[mask].iloc[0]
    resolved_department = (department or _safe_str(existing.get("department", "")) or "general")
    resolved_access = (access_level or _safe_str(existing.get("access_level", "")) or "internal")
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
    doc = _document_from_df(target, updated_df)
    if doc is None:
        return None
    return {
        "doc_id": target,
        "title": doc["title"],
        "text": doc["text"],
        "created_at": created_at,
        "updated_at": updated_at,
    }


def delete_document_core(doc_id: str, state: Optional[SearchState] = None) -> bool:
    if state is None:
        df, csv_path = _load_docs_state()
    else:
        csv_path = state.csv_path

    target = str(doc_id).strip()
    if not target:
        return False

    df = df if state is None else _ensure_admin_columns(state.df.copy())
    mask = df["doc_id"].astype(str) == target
    if not mask.any():
        return False

    updated_df = df[~mask].copy()
    _persist_docs(updated_df, csv_path)
    return True


def main() -> None:
    clear_screen()

    # ⬇️ ВАЖНО: теперь всё грузится 1 раз через кэш
    state = init_search()

    print_header(MODEL_NAME, state.csv_path)

    while True:
        try:
            q = input("\nQuery> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not q:
            continue

        if q.lower() in {":q", "exit", "quit"}:
            break

        t0 = time.time()

        # ⬇️ Используем обёртку, которая берёт кэш
        results = search_core(q, state)

        elapsed = time.time() - t0

        if not results:
            console_print("\n[bold yellow]No results found.[/bold yellow]")
            continue

        console_print()
        for i, r in enumerate(results, 1):
            score = r["score"]
            title = r.get("title", "")
            doc_id = r.get("doc_id", "")
            chunk_id = r.get("chunk_id", "")
            text = r.get("text", "")

            console_print(f"[bold cyan]{i}. Score: {score:.3f}[/bold cyan]")
            console_print(f"[dim]{doc_id} | {chunk_id} | {title}[/dim]")
            console_print(text[:400])
            console_print("-" * 60)

        console_print(f"[green]Done in {elapsed:.3f}s[/green]")

    console_print("\n[bold]Bye 👋[/bold]")


if __name__ == "__main__":
    main()
