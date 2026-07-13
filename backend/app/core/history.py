import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.config import HISTORY_SNAPSHOTS_PER_ENTRY


def snapshot(db: Session, history_model, parent_id_field: str, parent_id: int, data: dict) -> None:
    """Save a pre-change snapshot of `data`, then trim to the last N per entry."""
    entry = history_model(**{parent_id_field: parent_id, "snapshot_json": json.dumps(data), "snapshot_at": datetime.utcnow()})
    db.add(entry)
    db.flush()
    _trim(db, history_model, parent_id_field, parent_id)


def _trim(db: Session, history_model, parent_id_field: str, parent_id: int) -> None:
    rows = (
        db.query(history_model)
        .filter(getattr(history_model, parent_id_field) == parent_id)
        .order_by(history_model.snapshot_at.desc())
        .all()
    )
    for row in rows[HISTORY_SNAPSHOTS_PER_ENTRY:]:
        db.delete(row)


def list_snapshots(db: Session, history_model, parent_id_field: str, parent_id: int) -> list[dict]:
    rows = (
        db.query(history_model)
        .filter(getattr(history_model, parent_id_field) == parent_id)
        .order_by(history_model.snapshot_at.desc())
        .all()
    )
    return [{"id": row.id, "snapshot_at": row.snapshot_at.isoformat(), "data": json.loads(row.snapshot_json)} for row in rows]


def restore_latest(db: Session, history_model, parent_id_field: str, parent_id: int) -> dict | None:
    """Pop the most recent snapshot (undo) and return its data, or None if there's no history."""
    row = (
        db.query(history_model)
        .filter(getattr(history_model, parent_id_field) == parent_id)
        .order_by(history_model.snapshot_at.desc())
        .first()
    )
    if row is None:
        return None
    data = json.loads(row.snapshot_json)
    db.delete(row)
    db.flush()
    return data
