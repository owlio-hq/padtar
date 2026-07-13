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
    return [(notes, "")]
