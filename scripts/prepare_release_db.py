"""Build a CLEAN v4 database for the client handoff zip.

The dev DB (data/app.db) accumulates test data while we work. The shipped app
must instead start clean — one sample entry per sheet so the layout is visible,
and nothing else: no history/undo snapshots, no accumulated test days/batches.

This operates on a COPY of the dev DB via raw sqlite3 (so the dev DB is never
touched, and there's no dependence on the app's fixed DB_PATH), then drops the
result at release/Padtar/data/app.db. Auth, labels and editable defaults are
config — they're kept.

Run:  backend/.venv/Scripts/python.exe scripts/prepare_release_db.py
"""

import shutil
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEV_DB = ROOT / "data" / "app.db"
RELEASE_DB = ROOT / "release" / "Padtar" / "data" / "app.db"

KEEP_DAY = "2026-06-27"  # the real Rojmel sample day

# child -> (fk, parent): rows that must never outlive their parent (defensive
# purge; mirrors scripts/fresh_start.py so nothing invisible ships).
CHILD_TABLES = [
    ("shakkarpara_batch_ingredients", "batch_id", "shakkarpara_batches"),
    ("shakkarpara_oil_sit", "batch_id", "shakkarpara_batches"),
    ("shakkarpara_batch_history", "batch_id", "shakkarpara_batches"),
    ("rojmel_sales_lines", "day_id", "rojmel_days"),
    ("rojmel_income_lines", "day_id", "rojmel_days"),
    ("rojmel_expense_lines", "day_id", "rojmel_days"),
    ("rojmel_carry_forward_lines", "day_id", "rojmel_days"),
    ("rojmel_day_history", "day_id", "rojmel_days"),
]


def main() -> None:
    if not DEV_DB.exists():
        raise SystemExit(f"dev DB not found: {DEV_DB}")
    RELEASE_DB.parent.mkdir(parents=True, exist_ok=True)

    shutil.copy2(DEV_DB, RELEASE_DB)
    con = sqlite3.connect(RELEASE_DB)
    con.execute("PRAGMA foreign_keys=ON")  # so parent deletes cascade to children

    # Shakkarpara: keep only the single latest batch.
    con.execute(
        "DELETE FROM shakkarpara_batches WHERE id NOT IN "
        "(SELECT id FROM shakkarpara_batches ORDER BY date DESC LIMIT 1)"
    )
    # Rojmel: keep only the one real sample day.
    con.execute("DELETE FROM rojmel_days WHERE date <> ?", (KEEP_DAY,))

    # No history/undo snapshots ship — a fresh app has nothing to undo.
    con.execute("DELETE FROM shakkarpara_batch_history")
    con.execute("DELETE FROM rojmel_day_history")

    # Tidy the sample day: stock starts uncounted (NET 0, no red), no carried-over notes.
    con.execute("UPDATE rojmel_sales_lines SET opening_pic = 0, closing_pic = 0")
    con.execute("UPDATE rojmel_days SET notes = NULL")

    # Show the carry-forward section as a sample: the two default names, amount 0.
    # (The kept day predates that feature, so it has none — seed them here.)
    day_id = con.execute("SELECT id FROM rojmel_days WHERE date = ?", (KEEP_DAY,)).fetchone()[0]
    con.execute("DELETE FROM rojmel_carry_forward_lines WHERE day_id = ?", (day_id,))
    for i, name in enumerate(("Chirag bhai", "Chetna ben")):
        con.execute(
            "INSERT INTO rojmel_carry_forward_lines (day_id, name, amount, sort_order) VALUES (?, ?, 0, ?)",
            (day_id, name, i),
        )

    # Defensive orphan purge (covers any table whose FK cascade didn't fire).
    purged = 0
    for child, fk, parent in CHILD_TABLES:
        cur = con.execute(f"DELETE FROM {child} WHERE {fk} NOT IN (SELECT id FROM {parent})")
        purged += cur.rowcount or 0

    con.commit()
    con.execute("VACUUM")
    con.commit()

    # Report
    def count(t):
        return con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]

    print("Clean release DB written to", RELEASE_DB)
    print("  shakkarpara batches:", count("shakkarpara_batches"), "| history:", count("shakkarpara_batch_history"))
    print("  rojmel days:", count("rojmel_days"), "| history:", count("rojmel_day_history"))
    print("  carry-forward rows:", count("rojmel_carry_forward_lines"), "| orphans purged:", purged)
    con.close()


if __name__ == "__main__":
    main()
