"""
SQLite data access layer for the Support Ticket CRM.

Two tables, as specified:
  - tickets: the core ticket record
  - notes:   free-text notes/comments attached to a ticket (1-to-many)

Bonus fields (see README "Bonus / Standout" section):
  - priority     : lets a team triage instead of working tickets in raw order
  - assigned_to  : lets a team split hundreds of tickets/day across agents
  - screenshots  : lets a customer/agent attach images of the issue (JSON list of filenames)
"""
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Dict

DB_PATH = Path(__file__).resolve().parent / "tickets.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tickets (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id     TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            subject       TEXT NOT NULL,
            description   TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'Open',
            priority      TEXT NOT NULL DEFAULT 'Normal',
            assigned_to   TEXT,
            screenshots   TEXT NOT NULL DEFAULT '[]',
            created_at    TEXT NOT NULL,
            updated_at    TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS notes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id  TEXT NOT NULL REFERENCES tickets(ticket_id),
            note_text  TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _next_ticket_id(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT COUNT(*) AS c FROM tickets").fetchone()
    n = row["c"] + 1
    return f"TKT-{n:03d}"


def create_ticket(
    customer_name: str,
    customer_email: str,
    subject: str,
    description: str,
    priority: str = "Normal",
) -> Dict:
    conn = get_connection()
    ticket_id = _next_ticket_id(conn)
    now = _now()
    conn.execute(
        """INSERT INTO tickets
           (ticket_id, customer_name, customer_email, subject, description,
            status, priority, screenshots, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'Open', ?, '[]', ?, ?)""",
        (ticket_id, customer_name, customer_email, subject, description, priority, now, now),
    )
    conn.commit()
    conn.close()
    return {"ticket_id": ticket_id, "created_at": now}


def list_tickets(status: Optional[str] = None, search: Optional[str] = None) -> List[Dict]:
    conn = get_connection()
    query = (
        "SELECT ticket_id, customer_name, customer_email, subject, status, "
        "priority, assigned_to, created_at FROM tickets WHERE 1=1"
    )
    params: List[str] = []
    if status:
        query += " AND status = ?"
        params.append(status)
    if search:
        query += (
            " AND (customer_name LIKE ? OR customer_email LIKE ? OR "
            "ticket_id LIKE ? OR subject LIKE ? OR description LIKE ?)"
        )
        like = f"%{search}%"
        params.extend([like, like, like, like, like])
    query += " ORDER BY created_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_ticket(ticket_id: str) -> Optional[Dict]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,)).fetchone()
    if not row:
        conn.close()
        return None
    ticket = dict(row)

    # screenshots is stored as a JSON string in the DB; expose it as a list
    try:
        ticket["screenshots"] = json.loads(ticket.get("screenshots") or "[]")
    except (TypeError, ValueError):
        ticket["screenshots"] = []

    notes = conn.execute(
        "SELECT id, note_text, created_at FROM notes WHERE ticket_id = ? ORDER BY created_at ASC",
        (ticket_id,),
    ).fetchall()
    ticket["notes"] = [dict(n) for n in notes]
    conn.close()
    return ticket


def update_ticket(
    ticket_id: str,
    status: Optional[str] = None,
    note_text: Optional[str] = None,
    assigned_to: Optional[str] = None,
) -> str:
    conn = get_connection()
    now = _now()
    fields, params = [], []
    if status:
        fields.append("status = ?")
        params.append(status)
    if assigned_to is not None:
        fields.append("assigned_to = ?")
        params.append(assigned_to)
    if fields:
        fields.append("updated_at = ?")
        params.append(now)
        params.append(ticket_id)
        conn.execute(f"UPDATE tickets SET {', '.join(fields)} WHERE ticket_id = ?", params)
    else:
        conn.execute("UPDATE tickets SET updated_at = ? WHERE ticket_id = ?", (now, ticket_id))
    if note_text:
        conn.execute(
            "INSERT INTO notes (ticket_id, note_text, created_at) VALUES (?, ?, ?)",
            (ticket_id, note_text, now),
        )
    conn.commit()
    conn.close()
    return now


def add_screenshot(ticket_id: str, filename: str) -> None:
    """Append a screenshot filename to the ticket's JSON list."""
    conn = get_connection()
    row = conn.execute(
        "SELECT screenshots FROM tickets WHERE ticket_id = ?", (ticket_id,)
    ).fetchone()

    current: List[str] = []
    if row and row["screenshots"]:
        try:
            current = json.loads(row["screenshots"])
        except (TypeError, ValueError):
            current = []

    current.append(filename)

    conn.execute(
        "UPDATE tickets SET screenshots = ?, updated_at = ? WHERE ticket_id = ?",
        (json.dumps(current), _now(), ticket_id),
    )
    conn.commit()
    conn.close()

def delete_ticket(ticket_id: str) -> bool:
    """Delete a ticket and its associated notes. Returns True if a ticket was deleted."""
    conn = get_connection()
    cursor = conn.execute("DELETE FROM tickets WHERE ticket_id = ?", (ticket_id,))
    conn.execute("DELETE FROM notes WHERE ticket_id = ?", (ticket_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted