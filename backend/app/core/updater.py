"""Manual in-app updater (no git anywhere near the client).

The client is a business: an update must NEVER interrupt work or risk data. So
nothing is ever applied automatically — the app only checks (once a day, when
online), raises a notification, and applies strictly on an explicit click.

Apply flow (only after guard confirms allowed):
  1. download the branch zipball over HTTPS to a temp dir,
  2. verify EVERY code path exists in the archive before touching the install,
  3. back up the database,
  4. copy the code paths, keeping a rollback copy — any failure restores it,
  5. exit 42; the launcher's restart loop brings the server up on the new code.

Only backend/app, frontend/dist and VERSION are ever replaced. data/ (db,
backups, logs), the bundled python/ and the launcher are never touched.
"""

import os
import shutil
import tempfile
import threading
import time
import urllib.request
import zipfile
from datetime import datetime, timedelta
from pathlib import Path

from app.config import PROJECT_ROOT, REMOTE_VERSION_URL, UPDATE_ZIP_URL, app_version
from app.core.logging import logger

# Paths (relative to repo root) that an update is allowed to replace.
_CODE_PATHS = [("backend/app", "backend/app"), ("frontend/dist", "frontend/dist"), ("VERSION", "VERSION")]

RESTART_EXIT_CODE = 42
CHECK_EVERY = timedelta(days=1)


class UpdateError(RuntimeError):
    """Update could not be applied. The install is untouched (or rolled back)."""


class Offline(UpdateError):
    """Couldn't reach GitHub."""


def updates_enabled() -> bool:
    """Only the packaged install self-updates — never a dev checkout.

    Keyed off the bundled python/ runtime, which only the release folder has.
    (frontend/dist is no longer a valid marker: it's committed to the repo, so
    it exists in the dev tree too — using it would let a dev checkout overwrite
    its own source from GitHub.)
    """
    if os.environ.get("PADTAR_SKIP_ACCESS_CHECK") == "1":
        return False
    return (PROJECT_ROOT / "python").is_dir()


def _parse_version(v: str) -> tuple:
    """'2' -> (2,), '2.1' -> (2, 1). Non-numeric parts sort as 0."""
    parts = []
    for chunk in v.strip().split("."):
        try:
            parts.append(int(chunk))
        except ValueError:
            parts.append(0)
    return tuple(parts)


def is_newer(remote: str, local: str) -> bool:
    """True only when remote is a HIGHER version — never prompt to 'update'
    to an older build (e.g. after a rollback on our side)."""
    try:
        return _parse_version(remote) > _parse_version(local)
    except Exception:
        return remote.strip() != local.strip()


def fetch_remote_version(timeout: float = 5.0) -> str | None:
    url = f"{REMOTE_VERSION_URL}?t={int(time.time())}"  # cache-buster
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
    return is_newer(remote, app_version()), remote


# ---- daily check (cached in memory; never persisted) ----
_check = {"at": None, "available": False, "version": None, "offline": False}


def check_status(force: bool = False) -> dict:
    """Update status for the notification. Hits GitHub at most once a day —
    or straight away when forced, or when the last try failed (offline), so it
    catches up as soon as the machine is back online."""
    if not updates_enabled():
        return {"available": False, "version": app_version(), "offline": False, "checked": False}

    last = _check["at"]
    stale = last is None or _check["offline"] or (datetime.now() - last) >= CHECK_EVERY
    if force or stale:
        available, remote = update_available()
        _check.update(
            at=datetime.now(),
            available=available,
            version=remote or app_version(),
            offline=remote is None,
        )
        logger.info("Update check: available=%s remote=%s offline=%s", available, remote, remote is None)

    return {
        "available": _check["available"],
        "version": _check["version"] or app_version(),
        "offline": _check["offline"],
        "checked": True,
    }


def apply_update() -> str:
    """Download + apply the latest code. Returns the new version string.

    Safe to fail at any point: the archive is fully validated before anything is
    touched, and a rollback copy restores the old code if a copy dies midway.
    """
    with tempfile.TemporaryDirectory(prefix="padtar_update_") as tmp:
        tmp_path = Path(tmp)

        # 1. download
        zip_path = tmp_path / "update.zip"
        try:
            req = urllib.request.Request(UPDATE_ZIP_URL, headers={"User-Agent": "Padtar"})
            with urllib.request.urlopen(req, timeout=60) as resp, open(zip_path, "wb") as out:
                shutil.copyfileobj(resp, out)
        except Exception as exc:
            raise Offline("Could not download the update") from exc

        # 2. extract + validate EVERYTHING before touching the install
        extract_dir = tmp_path / "x"
        try:
            with zipfile.ZipFile(zip_path) as zf:
                zf.extractall(extract_dir)
        except Exception as exc:
            raise UpdateError("The downloaded update was damaged") from exc

        roots = [p for p in extract_dir.iterdir() if p.is_dir()]
        if len(roots) != 1:
            raise UpdateError("Unexpected update archive layout")
        src_root = roots[0]
        for src_rel, _ in _CODE_PATHS:
            if not (src_root / src_rel).exists():
                raise UpdateError(f"Update archive is incomplete (missing {src_rel})")

        # 3. back up the database first — belt and braces; the copy below never
        #    touches data/, but an update is exactly when you want a snapshot.
        try:
            from app.core.backup import backup_now

            backup_now()
        except Exception:  # a backup problem must not block the update
            logger.warning("Pre-update backup failed", exc_info=True)

        # 4. copy with rollback
        rollback = tmp_path / "rollback"
        rollback.mkdir()
        done: list[tuple[Path, Path]] = []  # (dst, saved_copy)
        try:
            for src_rel, dst_rel in _CODE_PATHS:
                src = src_root / src_rel
                dst = PROJECT_ROOT / dst_rel
                saved = rollback / dst_rel.replace("/", "__")
                if dst.exists():
                    if dst.is_dir():
                        shutil.copytree(dst, saved)
                    else:
                        saved.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(dst, saved)
                    done.append((dst, saved))

                if src.is_dir():
                    if dst_rel == "frontend/dist" and dst.exists():
                        shutil.rmtree(dst)  # static assets are hashed — clear stale ones
                    shutil.copytree(src, dst, dirs_exist_ok=True)
                else:
                    shutil.copyfile(src, dst)
        except Exception as exc:
            logger.error("Update copy failed — rolling back: %s", exc)
            for dst, saved in done:
                try:
                    if saved.is_dir():
                        if dst.exists():
                            shutil.rmtree(dst)
                        shutil.copytree(saved, dst)
                    else:
                        shutil.copyfile(saved, dst)
                except Exception:
                    logger.critical("ROLLBACK FAILED for %s", dst, exc_info=True)
            raise UpdateError("Update failed and was undone — the app is unchanged") from exc

    new_version = app_version()
    _check.update(at=None, available=False, version=new_version, offline=False)
    logger.info("Update applied — now at version %s", new_version)
    return new_version


def schedule_restart(delay: float = 1.5) -> None:
    """Exit with the restart code shortly after the HTTP response is sent;
    the launcher .bat loop starts the server again on the new code."""
    logger.info("Restarting to finish update (exit %s)", RESTART_EXIT_CODE)
    threading.Timer(delay, os._exit, args=(RESTART_EXIT_CODE,)).start()
