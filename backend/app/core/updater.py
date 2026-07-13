"""Manual in-app updater (no git anywhere near the client).

Flow (only after guard confirms allowed): compare local VERSION with the
repo's; if newer, download the branch zipball over HTTPS, extract to a temp
dir, and copy ONLY code paths — backend/app, frontend/dist, VERSION — over the
install. data/ (db, backups, logs), the bundled python/ and the launcher .bat
are never touched. Then exit with code 42; the launcher's restart loop brings
the server back up on the new code.

Refuses to apply in dev (no packaged frontend/dist or guard skipped) so a dev
checkout never overwrites itself from GitHub.
"""

import os
import shutil
import tempfile
import threading
import time
import urllib.request
import zipfile
from pathlib import Path

from app.config import FRONTEND_DIST_DIR, PROJECT_ROOT, REMOTE_VERSION_URL, UPDATE_ZIP_URL, app_version
from app.core.logging import logger

# Paths (relative to repo root) that an update is allowed to replace.
_CODE_PATHS = [("backend/app", "backend/app"), ("frontend/dist", "frontend/dist"), ("VERSION", "VERSION")]

RESTART_EXIT_CODE = 42


def updates_enabled() -> bool:
    """Only the packaged install self-updates — never a dev checkout."""
    return FRONTEND_DIST_DIR.exists() and os.environ.get("PADTAR_SKIP_ACCESS_CHECK") != "1"


def fetch_remote_version(timeout: float = 5.0) -> str | None:
    url = f"{REMOTE_VERSION_URL}?t={int(time.time())}"
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "Padtar"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8").strip()
    except Exception:
        return None


def update_available() -> tuple[bool, str | None]:
    remote = fetch_remote_version()
    if remote is None:
        return False, None
    return remote != app_version(), remote


def apply_update() -> str:
    """Download + apply the latest code. Returns the new version string.
    Raises on any failure (nothing is half-applied before the copy step)."""
    with tempfile.TemporaryDirectory(prefix="padtar_update_") as tmp:
        zip_path = Path(tmp) / "update.zip"
        req = urllib.request.Request(UPDATE_ZIP_URL, headers={"User-Agent": "Padtar"})
        with urllib.request.urlopen(req, timeout=60) as resp, open(zip_path, "wb") as out:
            shutil.copyfileobj(resp, out)

        extract_dir = Path(tmp) / "x"
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(extract_dir)
        # zipball contains a single "<repo>-<branch>/" root folder
        roots = [p for p in extract_dir.iterdir() if p.is_dir()]
        if len(roots) != 1:
            raise RuntimeError("Unexpected update archive layout")
        src_root = roots[0]

        for src_rel, dst_rel in _CODE_PATHS:
            src = src_root / src_rel
            dst = PROJECT_ROOT / dst_rel
            if not src.exists():
                raise RuntimeError(f"Update archive missing {src_rel}")
            if src.is_dir():
                if dst_rel == "frontend/dist" and dst.exists():
                    shutil.rmtree(dst)  # static assets are hashed — clear stale ones
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copyfile(src, dst)

    new_version = app_version()
    logger.info("Update applied — now at version %s", new_version)
    return new_version


def schedule_restart(delay: float = 1.5) -> None:
    """Exit with the restart code shortly after the HTTP response is sent;
    the launcher .bat loop starts the server again on the new code."""
    logger.info("Restarting to finish update (exit %s)", RESTART_EXIT_CODE)
    threading.Timer(delay, os._exit, args=(RESTART_EXIT_CODE,)).start()
