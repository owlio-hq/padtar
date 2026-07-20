import os
import threading
import webbrowser

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import APP_NAME, FRONTEND_DIST_DIR, app_version
from app.core import auth as auth_core
from app.core import backup as backup_core
from app.core import bug_reports, guard, updater
from app.core import labels as labels_core
from app.core import settings as settings_core
from app.core.labels import LabelIn, LabelOut
from app.core.logging import logger
from app.db import get_db, init_db
from app.modules.rojmel.router import router as rojmel_router
from app.modules.shakkarpara.router import router as shakkarpara_router

app = FastAPI(title=APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    # Remote flag first, before anything else runs (offline -> date fallback).
    guard.check_access()
    logger.info("%s backend started (v%s)", APP_NAME, app_version())

    # Packaged mode: the hidden launcher sets this so the app opens the client's
    # browser itself once the server is up (no visible terminal gymnastics).
    # Only on first start — the update-restart loop clears it, so applying an
    # update doesn't pop a second tab.
    if os.environ.get("PADTAR_OPEN_BROWSER") == "1" and FRONTEND_DIST_DIR.exists():
        threading.Timer(0.6, webbrowser.open, args=("http://127.0.0.1:8123/",)).start()


@app.middleware("http")
async def access_guard_middleware(request, call_next):
    path = request.url.path
    if (
        guard.is_locked()
        and path.startswith("/api/")
        and not path.startswith("/api/system")
        and path != "/api/health"
    ):
        return JSONResponse({"detail": "locked", "message": guard.LOCK_MESSAGE}, status_code=423)
    return await call_next(request)


app.include_router(shakkarpara_router)
app.include_router(rojmel_router)


@app.get("/api/labels", response_model=list[LabelOut])
def list_labels(db: Session = Depends(get_db)):
    return labels_core.get_all(db)


@app.put("/api/labels/{key}", response_model=LabelOut)
def update_label(key: str, payload: LabelIn, db: Session = Depends(get_db)):
    return labels_core.set_label(db, key, payload.gujarati_label, payload.english_label)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": APP_NAME}


# -------- Auth (two-level password) --------

class PasswordIn(BaseModel):
    password: str


class ChangePasswordIn(BaseModel):
    which: str          # "login" | "edit"
    current_edit: str   # current edit password authorises any change
    new_password: str


@app.post("/api/auth/login")
def auth_login(payload: PasswordIn, db: Session = Depends(get_db)):
    return {"ok": auth_core.verify_login(db, payload.password)}


@app.post("/api/auth/verify-edit")
def auth_verify_edit(payload: PasswordIn, db: Session = Depends(get_db)):
    return {"ok": auth_core.verify_edit(db, payload.password)}


@app.post("/api/auth/change-password")
def auth_change_password(payload: ChangePasswordIn, db: Session = Depends(get_db)):
    if not auth_core.verify_edit(db, payload.current_edit):
        raise HTTPException(status_code=403, detail="Wrong edit password")
    if payload.which == "login":
        auth_core.set_login(db, payload.new_password)
    elif payload.which == "edit":
        auth_core.set_edit(db, payload.new_password)
    else:
        raise HTTPException(status_code=400, detail="which must be 'login' or 'edit'")
    return {"ok": True}


# -------- Settings --------

class SettingIn(BaseModel):
    value: str


@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    return settings_core.all_with_defaults(db)


@app.put("/api/settings/{key}")
def update_setting(key: str, payload: SettingIn, db: Session = Depends(get_db)):
    row = settings_core.set_value(db, key, payload.value)
    return {"key": row.key, "value": row.value}


# -------- Backups --------

class BackupOut(BaseModel):
    filename: str
    taken_at: str
    size_bytes: int


class RestoreIn(BaseModel):
    filename: str


class PruneIn(BaseModel):
    months: int


@app.get("/api/backups", response_model=list[BackupOut])
def list_backups():
    return [
        {"filename": b.filename, "taken_at": b.taken_at.isoformat(), "size_bytes": b.size_bytes}
        for b in backup_core.list_backups()
    ]


@app.post("/api/backups/now", response_model=BackupOut)
def backup_now_endpoint():
    path = backup_core.backup_now()
    if path is None:
        raise HTTPException(status_code=400, detail="No live database to back up")
    stat = path.stat()
    taken = backup_core._parse_ts_from_name(path.name)
    return {
        "filename": path.name,
        "taken_at": taken.isoformat() if taken else "",
        "size_bytes": stat.st_size,
    }


@app.post("/api/backups/restore")
def restore_backup(payload: RestoreIn):
    try:
        backup_core.restore(payload.filename)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


@app.post("/api/backups/prune")
def prune_backups(payload: PruneIn):
    deleted = backup_core.prune_older_than(payload.months)
    return {"deleted": deleted}


# -------- System: access status + manual update --------

@app.get("/api/system/status")
def system_status():
    return {**guard.state(), "version": app_version()}


@app.get("/api/system/update-status")
def system_update_status():
    """Cheap poll for the sidebar notification. Only actually hits GitHub once a
    day (or as soon as the machine is back online) — never applies anything."""
    info = updater.check_status()
    return {**info, "current": app_version()}


@app.post("/api/system/check-update")
def system_check_update(force: bool = True):
    """Look for an update WITHOUT applying it. The remote flag is re-checked
    first — a denied client is never told about updates."""
    result = guard.check_access()
    if result["locked"]:
        return {"status": "locked", "message": guard.LOCK_MESSAGE}
    if not updater.updates_enabled():
        return {"status": "dev", "version": app_version()}
    if result["flag"] == "offline":
        return {"status": "offline"}

    info = updater.check_status(force=force)
    if info["offline"]:
        return {"status": "offline"}
    if not info["available"]:
        return {"status": "up_to_date", "version": app_version()}
    return {"status": "available", "version": info["version"], "current": app_version()}


@app.post("/api/system/apply-update")
def system_apply_update():
    """Apply the update — only ever reached by an explicit click, after the
    client has saved any open work."""
    result = guard.check_access()
    if result["locked"]:
        return {"status": "locked", "message": guard.LOCK_MESSAGE}
    if not updater.updates_enabled():
        return {"status": "dev"}
    if result["flag"] == "offline":
        return {"status": "offline"}

    try:
        new_version = updater.apply_update()
    except updater.Offline:
        return {"status": "offline"}
    except updater.UpdateError as exc:
        logger.error("Update failed: %s", exc)
        return {"status": "error", "message": str(exc)}
    except Exception as exc:  # unexpected — the install was rolled back
        logger.exception("Unexpected update failure")
        return {"status": "error", "message": "Update failed — the app is unchanged. Try again later."}

    updater.schedule_restart()
    return {"status": "updated", "version": new_version}


class BugReportIn(BaseModel):
    description: str
    context: dict = {}


@app.post("/api/system/report-bug")
def system_report_bug(payload: BugReportIn):
    """Send a client-reported problem to GitHub as an issue. Never applies or
    changes anything locally — purely a one-way report the client controls."""
    result = guard.check_access()
    if result["locked"]:
        return {"status": "locked", "message": guard.LOCK_MESSAGE}
    if not bug_reports.configured():
        return {"status": "not_configured"}
    description = payload.description.strip()
    if not description:
        return {"status": "error", "message": "Nothing to report."}

    try:
        url = bug_reports.submit(description, payload.context)
    except bug_reports.Offline:
        return {"status": "offline"}
    except bug_reports.ReportError as exc:
        return {"status": "error", "message": str(exc)}
    return {"status": "sent", "url": url}


# -------- Frontend static build --------
# Present only in the packaged distributable (npm run build output). In normal
# dev, Vite's own dev server serves the frontend on :5173 instead, so this is
# skipped entirely. Registered last so it never shadows an /api/* route above.
if FRONTEND_DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST_DIR / "assets"), name="assets")

    # index.html must never be cached: it references the current build's asset
    # filenames (index-<hash>.js/css). After an in-app update the hashes change,
    # so a cached index.html points at files that no longer exist — the browser
    # then renders the OLD UI until the user hard-refreshes. The /assets files
    # themselves are safe to cache: their names change every build.
    _NO_CACHE = {"Cache-Control": "no-store, must-revalidate"}

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        candidate = FRONTEND_DIST_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST_DIR / "index.html", headers=_NO_CACHE)
