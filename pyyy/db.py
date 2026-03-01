import os
from typing import Optional

import pandas as pd
import psycopg


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
_SCHEMA_READY = False


def is_enabled() -> bool:
    return bool(DATABASE_URL)


def _connect():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg.connect(DATABASE_URL)


def ensure_schema() -> None:
    global _SCHEMA_READY
    if _SCHEMA_READY or not is_enabled():
        return

    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    doc_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    department TEXT NOT NULL DEFAULT 'general',
                    access_level TEXT NOT NULL DEFAULT 'internal',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS document_chunks (
                    doc_id TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
                    chunk_id TEXT PRIMARY KEY,
                    chunk_index INTEGER NOT NULL,
                    text TEXT NOT NULL
                )
                """
            )
        conn.commit()

    _SCHEMA_READY = True


def load_docs_df() -> pd.DataFrame:
    ensure_schema()
    with _connect() as conn:
        query = """
            SELECT
                d.doc_id,
                c.chunk_id,
                d.title,
                d.department,
                d.access_level,
                c.text,
                d.created_at,
                d.updated_at
            FROM documents d
            JOIN document_chunks c ON c.doc_id = d.doc_id
            ORDER BY d.doc_id, c.chunk_index
        """
        df = pd.read_sql_query(query, conn)
    return df


def has_any_documents() -> bool:
    ensure_schema()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT EXISTS (SELECT 1 FROM documents)")
            row = cur.fetchone()
    return bool(row and row[0])


def save_docs_df(df: pd.DataFrame) -> None:
    ensure_schema()
    normalized = df.fillna("").copy()

    docs = (
        normalized.sort_values(["doc_id", "chunk_id"], kind="stable")
        .groupby("doc_id", sort=True)
        .first()
        .reset_index()
    )

    chunks = normalized.sort_values(["doc_id", "chunk_id"], kind="stable").copy()
    chunks["chunk_index"] = chunks.groupby("doc_id", sort=False).cumcount() + 1
    chunks["chunk_id"] = chunks.apply(
        lambda row: f"{str(row['doc_id'])}_C{int(row['chunk_index']):02d}",
        axis=1,
    )

    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM document_chunks")
            cur.execute("DELETE FROM documents")

            for doc in docs.itertuples(index=False):
                cur.execute(
                    """
                    INSERT INTO documents (
                        doc_id, title, department, access_level, created_at, updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(doc.doc_id),
                        str(doc.title),
                        str(doc.department or "general"),
                        str(doc.access_level or "internal"),
                        str(doc.created_at),
                        str(doc.updated_at),
                    ),
                )

            for chunk in chunks.itertuples(index=False):
                cur.execute(
                    """
                    INSERT INTO document_chunks (
                        doc_id, chunk_id, chunk_index, text
                    )
                    VALUES (%s, %s, %s, %s)
                    """,
                    (
                        str(chunk.doc_id),
                        str(chunk.chunk_id),
                        int(chunk.chunk_index),
                        str(chunk.text),
                    ),
                )
        conn.commit()
