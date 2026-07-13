"""Backup management: take snapshots, list them, restore, and optional prune.

Every save calls `backup_now()` — a consistent SQLite snapshot into
`data/backups/`. Nothing is deleted unless the user explicitly opts in via the
`backup.auto_delete_enabled` setting (see [[app.core.settings]]) — the client
also keeps daily physical printouts, so we err on the side of keeping everything.
"""

import shutil
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from app.config import BACKUPS_DIR, DB_PATH
from app.core.logging import logger


@dataclass
class BackupFile:
    filename: str
    taken_at: datetime
    size_bytes: int


def backup_now() -> Path | None:
    """Take a consistent snapshot of the live SQLite db into data/backups/.

    Uses SQLite's own backup API (not a raw file copy) so a snapshot taken
    mid-write (WAL mode) is still a valid, openable database file. Returns the
    path to the new backup, or None if the DB doesn't exist yet.
    """
    if not DB_PATH.exists():
        return None

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    dest_path = BACKUPS_DIR / f"app_{timestamp}.db"

    source_conn = sqlite3.connect(str(DB_PATH))
    dest_conn = sqlite3.connect(str(dest_path))
    try:
        source_conn.backup(dest_conn)
    finally:
        dest_conn.close()
        source_conn.close()

    logger.info("Backup written to %s", dest_path.name)
    return dest_path


def _parse_ts_from_name(name: str) -> datetime | None:
    # filename format: app_YYYYMMDD_HHMMSS_ffffff.db
    if not (name.startswith("app_") and name.endswith(".db")):
        return None
    try:
        stem = name[4:-3]  # strip "app_" and ".db"
        return datetime.strptime(stem, "%Y%m%d_%H%M%S_%f")
    except ValueError:
        return None


def list_backups() -> list[BackupFile]:
    """Newest-first list of backup files with their timestamps and sizes."""
    if not BACKUPS_DIR.exists():
        return []
    entries: list[BackupFile] = []
    for path in BACKUPS_DIR.iterdir():
        if not path.is_file():
            continue
        taken = _parse_ts_from_name(path.name)
        if taken is None:
            continue
        entries.append(BackupFile(filename=path.name, taken_at=taken, size_bytes=path.stat().st_size))
    entries.sort(key=lambda b: b.taken_at, reverse=True)
    return entries


def restore(filename: str) -> None:
    """Replace the live DB with the given backup file.

    A safety backup of the current DB is taken first, so a mistaken restore
    can itself be undone by restoring that safety snapshot.
    """
    src = BACKUPS_DIR / filename
    if not src.exists() or _parse_ts_from_name(filename) is None:
        raise FileNotFoundError(f"Backup not found: {filename}")

    backup_now()  # safety snapshot of the current state before replacing

    # Overwrite via SQLite backup API into a temp file, then move — this keeps
    # the destination file valid even if the process is killed mid-copy.
    tmp = DB_PATH.with_suffix(".restoring.db")
    src_conn = sqlite3.connect(str(src))
    dst_conn = sqlite3.connect(str(tmp))
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()
    shutil.move(str(tmp), str(DB_PATH))
    logger.info("Restored DB from backup %s", filename)


def prune_older_than(months: int) -> int:
    """Delete backups older than `months` months. Returns count deleted."""
    if months <= 0:
        return 0
    cutoff = datetime.now() - timedelta(days=30 * months)
    deleted = 0
    for b in list_backups():
        if b.taken_at < cutoff:
            (BACKUPS_DIR / b.filename).unlink(missing_ok=True)
            deleted += 1
    if deleted:
        logger.info("Pruned %d backup(s) older than %d month(s)", deleted, months)
    return deleted
