from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import APP_NAME, FRONTEND_DIST_DIR, app_version
from app.core import auth as auth_core
from app.core import backup as backup_core
from app.core import guard, updater
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


@app.post("/api/system/check-update")
def system_check_update():
    """Manual 'Check for Update'. Remote flag is re-checked FIRST; an update is
    only ever applied when the flag says allowed."""
    result = guard.check_access()
    if result["locked"]:
        return {"status": "locked", "message": guard.LOCK_MESSAGE}
    if result["flag"] == "offline":
        return {"status": "offline"}
    if not updater.updates_enabled():
        return {"status": "dev"}

    available, remote_version = updater.update_available()
    if remote_version is None:
        return {"status": "offline"}
    if not available:
        return {"status": "up_to_date", "version": app_version()}

    try:
        new_version = updater.apply_update()
    except Exception as exc:
        logger.error("Update failed: %s", exc)
        return {"status": "error", "message": "Update failed — nothing was changed. Try again later."}
    updater.schedule_restart()
    return {"status": "updated", "version": new_version}


# -------- Frontend static build --------
# Present only in the packaged distributable (npm run build output). In normal
# dev, Vite's own dev server serves the frontend on :5173 instead, so this is
# skipped entirely. Registered last so it never shadows an /api/* route above.
if FRONTEND_DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        candidate = FRONTEND_DIST_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
