"""
Customer Support Ticketing CRM — FastAPI backend.

Endpoints (as specified):
  POST /api/tickets            -> create a ticket
  GET  /api/tickets             -> list tickets (?status=, ?search=)
  GET  /api/tickets/{ticket_id} -> ticket detail incl. notes
  PUT  /api/tickets/{ticket_id} -> update status / assignee / add a note

Bonus:
  POST /api/tickets/{ticket_id}/upload -> attach a screenshot to a ticket

Serves the static frontend (Tailwind + vanilla JS) from /static and at "/".
"""
import shutil
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import database

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = STATIC_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Only allow common image types for screenshots
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB

app = FastAPI(title="Support Ticket CRM", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

database.init_db()


class TicketCreate(BaseModel):
    customer_name: str
    customer_email: str
    subject: str
    description: str
    priority: Optional[str] = "Normal"  # Low | Normal | High | Urgent


class TicketUpdate(BaseModel):
    status: Optional[str] = None       # Open | In Progress | Closed
    note_text: Optional[str] = None
    assigned_to: Optional[str] = None  # bonus: team-member email/name


# ---------------------------------------------------------------- API ----

@app.post("/api/tickets")
def create_ticket(payload: TicketCreate):
    return database.create_ticket(
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        subject=payload.subject,
        description=payload.description,
        priority=payload.priority or "Normal",
    )


@app.get("/api/tickets")
def list_tickets(status: Optional[str] = None, search: Optional[str] = None):
    return database.list_tickets(status=status, search=search)


@app.get("/api/tickets/{ticket_id}")
def get_ticket(ticket_id: str):
    ticket = database.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@app.put("/api/tickets/{ticket_id}")
def update_ticket(ticket_id: str, payload: TicketUpdate):
    if not database.get_ticket(ticket_id):
        raise HTTPException(status_code=404, detail="Ticket not found")
    updated_at = database.update_ticket(
        ticket_id,
        status=payload.status,
        note_text=payload.note_text,
        assigned_to=payload.assigned_to,
    )
    return {"success": True, "updated_at": updated_at}

@app.delete("/api/tickets/{ticket_id}")
def delete_ticket(ticket_id: str):
    if not database.get_ticket(ticket_id):
        raise HTTPException(status_code=404, detail="Ticket not found")
    database.delete_ticket(ticket_id)
    return {"success": True}


@app.post("/api/tickets/{ticket_id}/upload")
async def upload_screenshot(ticket_id: str, file: UploadFile = File(...)):
    if not database.get_ticket(ticket_id):
        raise HTTPException(status_code=404, detail="Ticket not found")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    file_ext = Path(file.filename or "").suffix or ".png"
    safe_filename = f"{ticket_id}_{int(time.time() * 1000)}{file_ext}"
    filepath = UPLOADS_DIR / safe_filename

    size = 0
    with open(filepath, "wb") as out_file:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                out_file.close()
                filepath.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail="File too large (max 5MB)")
            out_file.write(chunk)

    database.add_screenshot(ticket_id, safe_filename)

    return {"filename": safe_filename, "url": f"/static/uploads/{safe_filename}"}


# ------------------------------------------------------------ Frontend ----

class NoCacheStaticFiles(StaticFiles):
    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-store"
        return response


app.mount("/static", NoCacheStaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def serve_index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/ticket")
def serve_ticket_page():
    return FileResponse(STATIC_DIR / "ticket.html")