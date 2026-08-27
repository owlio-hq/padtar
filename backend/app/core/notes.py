"""Structured notes helper.

Notes are stored in the existing `notes` TEXT column. New entries save a JSON
array of [note, detail] pairs (the 2-column notes grid in the UI); older
entries may still hold plain text. `parse_notes` normalises both shapes to a
list of (note, detail) rows so exports can render one row per line instead of
dumping everything into a single cell.
"""

import json


def parse_notes(notes: str | None) -> list[tuple[str, str]]:
    if not notes or not notes.strip():
        return []
    try:
        data = json.loads(notes)
        if isinstance(data, list):
            rows: list[tuple[str, str]] = []
            for r in data:
                if isinstance(r, (list, tuple)):
                    a = str(r[0]) if len(r) > 0 and r[0] is not None else ""
                    b = str(r[1]) if len(r) > 1 and r[1] is not None else ""
                    if a.strip() or b.strip():
                        rows.append((a, b))
            return rows
    except (ValueError, TypeError):
        pass
    # Legacy plain text — split on newlines and semicolons so each chunk
    # becomes its own row instead of one giant cell in exports.
    rows: list[tuple[str, str]] = []
    for line in notes.splitlines():
        for chunk in line.split(";"):
            chunk = chunk.strip()
            if not chunk:
                continue
            # Try to extract "label: amount" pairs (e.g. "lift: 3000")
            if ":" in chunk:
                parts = chunk.rsplit(":", 1)
                label, maybe_amt = parts[0].strip(), parts[1].strip()
                # If the right side looks numeric, treat it as the amount
                cleaned = maybe_amt.replace(",", "").replace(" ", "")
                try:
                    float(cleaned)
                    rows.append((label, maybe_amt))
                    continue
                except ValueError:
                    pass
            rows.append((chunk, ""))
    return rows if rows else [(notes, "")]
