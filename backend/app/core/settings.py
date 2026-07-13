"""Simple key-value settings store.

Backed by a tiny `settings` table, one row per key. Used for user-facing
knobs like backup retention. Kept separate from `labels` because these are
plain string values, not bilingual pairs.
"""

from pydantic import BaseModel
from sqlalchemy import String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.db import Base


class SettingRow(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False, default="")


class SettingOut(BaseModel):
    key: str
    value: str


# Sensible defaults. auto_delete_enabled defaults OFF per Vasu — the client
# keeps physical printouts, so we never prune without explicit opt-in.
DEFAULTS: dict[str, str] = {
    "backup.auto_delete_enabled": "false",
    "backup.retention_months": "12",
}


def get(db: Session, key: str) -> str:
    row = db.get(SettingRow, key)
    if row is not None:
        return row.value
    return DEFAULTS.get(key, "")


def set_value(db: Session, key: str, value: str) -> SettingRow:
    row = db.get(SettingRow, key)
    if row is None:
        row = SettingRow(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()
    db.refresh(row)
    return row


def all_with_defaults(db: Session) -> dict[str, str]:
    stored = {r.key: r.value for r in db.query(SettingRow).all()}
    merged = {**DEFAULTS, **stored}
    return merged
