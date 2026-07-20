"""Prepare the DB for client handoff: keep a few real sample entries, wipe the rest.

Keeps 3 Shakkarpara batches (earliest, middle, latest of the imported range) and
the single Rojmel day. Fixes the kept batches so they match the new model:
  - ingredient categories assigned by name
  - "Mansho" ingredient renamed to "Worker"

The client starts essentially fresh but has a few realistic samples to look at.
Run from the backend venv:
  backend/.venv/Scripts/python.exe scripts/fresh_start.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import text  # noqa: E402

from app.db import SessionLocal, init_db  # noqa: E402
from app.modules.shakkarpara.models import Batch  # noqa: E402
from app.modules.rojmel.models import RojmelDay  # noqa: E402

NAME_TO_CATEGORY = {
    "menda": "Raw Material",
    "elaichi": "Raw Material",
    "sugar": "Raw Material",
    "ghee": "Raw Material",
    "masala": "Raw Material",
    "oil": "Cooking/Frying",
    "oil vaprayel": "Cooking/Frying",
    "pelet": "Fuel",
    "box & plastic": "Packaging",
    "worker": "Worker",
    "mansho": "Worker",
}


def categorize(name: str) -> str:
    return NAME_TO_CATEGORY.get(name.strip().lower(), "Raw Material")


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        batches = db.query(Batch).order_by(Batch.date).all()
        if not batches:
            print("No batches — nothing to trim.")
        else:
            # pick earliest, middle, latest to keep
            keep_ids = {batches[0].id, batches[len(batches) // 2].id, batches[-1].id}
            removed = 0
            for b in batches:
                if b.id not in keep_ids:
                    db.delete(b)
                    removed += 1
            db.commit()

            # fix the kept batches
            for b in db.query(Batch).all():
                for ing in b.ingredients:
                    if ing.name.strip().lower() == "mansho":
                        ing.name = "Worker"
                    ing.category = categorize(ing.name)
            db.commit()

            kept = db.query(Batch).order_by(Batch.date).all()
            print(f"Kept {len(kept)} sample batches, removed {removed}:")
            for b in kept:
                cats = {i.category for i in b.ingredients}
                print(f"   {b.date}  ({len(b.ingredients)} items, categories: {sorted(cats)})")

        print(f"Rojmel days kept: {db.query(RojmelDay).count()}")

        purged = purge_orphans(db)
        print(f"Orphaned child rows purged: {purged}")
        db.execute(text("VACUUM"))
        db.commit()
    finally:
        db.close()
    print("\nDone. DB ready for handoff.")


# Child tables that must never outlive their parent. Deleting a parent through
# the ORM cascades — but a raw "DELETE FROM ..." does NOT, because SQLite only
# enforces foreign keys on connections that switch them on. That is exactly how
# a pile of invisible orphan rows once ended up in a shipped database, so we
# purge defensively no matter how the rows were removed.
_CHILD_TABLES = [
    ("shakkarpara_batch_ingredients", "batch_id", "shakkarpara_batches"),
    ("shakkarpara_oil_sit", "batch_id", "shakkarpara_batches"),
    ("shakkarpara_batch_history", "batch_id", "shakkarpara_batches"),
    ("rojmel_sales_lines", "day_id", "rojmel_days"),
    ("rojmel_income_lines", "day_id", "rojmel_days"),
    ("rojmel_expense_lines", "day_id", "rojmel_days"),
    ("rojmel_carry_forward_lines", "day_id", "rojmel_days"),
    ("rojmel_day_history", "day_id", "rojmel_days"),
]


def purge_orphans(db) -> int:
    """Delete child rows whose parent is gone. Returns how many were removed."""
    total = 0
    for child, fk, parent in _CHILD_TABLES:
        # table/column names are fixed constants above — no user input here
        result = db.execute(text(f"DELETE FROM {child} WHERE {fk} NOT IN (SELECT id FROM {parent})"))
        total += result.rowcount or 0
    db.commit()
    return total


if __name__ == "__main__":
    main()
