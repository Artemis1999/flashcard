from __future__ import annotations

import csv
import os
import sqlite3
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("QUERY2CARD_DB", BASE_DIR / "query2card.db"))
STATIC_DIR = BASE_DIR / "static"
HOST = os.environ.get("QUERY2CARD_HOST", "127.0.0.1")
PORT = int(os.environ.get("QUERY2CARD_PORT", "22333"))


class QueryLogIn(BaseModel):
    question: str
    platform: str = "unknown"
    url: Optional[str] = ""
    title: Optional[str] = ""
    source: Optional[str] = "browser"


class QueryLogUpdate(BaseModel):
    answer: Optional[str] = None
    note: Optional[str] = None
    tags: Optional[str] = None
    is_reviewed: Optional[int] = None
    is_flashcard: Optional[int] = None


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS query_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                date TEXT NOT NULL,
                question TEXT NOT NULL,
                platform TEXT,
                url TEXT,
                title TEXT,
                source TEXT,
                answer TEXT DEFAULT '',
                note TEXT DEFAULT '',
                tags TEXT DEFAULT '',
                is_reviewed INTEGER DEFAULT 0,
                is_flashcard INTEGER DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_recent
            ON query_logs(date, question, platform, url)
            """
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Query2Card Local API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return (STATIC_DIR / "index.html").read_text(encoding="utf-8")


@app.post("/api/logs")
def create_log(item: QueryLogIn):
    question = item.question.strip()
    if not question:
        return {"ok": False, "reason": "empty question"}

    now = datetime.now()
    today = now.date().isoformat()

    with get_conn() as conn:
        try:
            cur = conn.execute(
                """
                INSERT INTO query_logs
                (created_at, date, question, platform, url, title, source)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    now.isoformat(timespec="seconds"),
                    today,
                    question,
                    item.platform,
                    item.url or "",
                    item.title or "",
                    item.source or "browser",
                ),
            )
            return {"ok": True, "id": cur.lastrowid}
        except sqlite3.IntegrityError:
            return {"ok": True, "duplicate": True}


@app.get("/api/logs")
def list_logs(day: str = Query(default_factory=lambda: date.today().isoformat())):
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM query_logs
            WHERE date = ?
            ORDER BY created_at DESC
            """,
            (day,),
        ).fetchall()
    return {"items": [dict(row) for row in rows]}


@app.put("/api/logs/{log_id}")
def update_log(log_id: int, item: QueryLogUpdate):
    fields = []
    values = []

    dump = item.model_dump(exclude_unset=True) if hasattr(item, "model_dump") else item.dict(exclude_unset=True)
    for key, value in dump.items():
        fields.append(f"{key} = ?")
        values.append(value)

    if not fields:
        return {"ok": False, "reason": "nothing to update"}

    values.append(log_id)

    with get_conn() as conn:
        conn.execute(
            f"UPDATE query_logs SET {', '.join(fields)} WHERE id = ?",
            values,
        )
    return {"ok": True}


@app.delete("/api/logs/{log_id}")
def delete_log(log_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM query_logs WHERE id = ?", (log_id,))
    return {"ok": True}


@app.get("/api/export.csv")
def export_csv(day: str = Query(default_factory=lambda: date.today().isoformat())):
    export_path = DB_PATH.parent / f"query_logs_{day}.csv"

    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT created_at, platform, question, answer, tags, is_flashcard, url
            FROM query_logs
            WHERE date = ?
            ORDER BY created_at ASC
            """,
            (day,),
        ).fetchall()

    with export_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["time", "platform", "question/search", "answer", "tags", "is_flashcard", "url"])
        for row in rows:
            writer.writerow([row[k] for k in row.keys()])

    return FileResponse(export_path, filename=export_path.name)


if __name__ == "__main__":
    init_db()
    uvicorn.run(app, host=HOST, port=PORT)
