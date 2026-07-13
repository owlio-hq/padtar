"""Shared color palette for Excel/PDF exports — mirrors the app's semantic
tints (which themselves mirror the original Excel's fill colors: rate=blue,
usage=yellow, unit/total=green) so exported documents look consistent with
the on-screen UI. Kept in one place so both modules' exporters match."""

# openpyxl-style hex (no '#')
HEADER_FILL = "F1F3F5"
RATE_FILL = "DCEEFB"
RATE_TEXT = "1C5D85"
USAGE_FILL = "FDF3D0"
USAGE_TEXT = "8A6D1A"
# Light green — used only for the per-ingredient Total *column* (mirrors screen tint).
TOTAL_FILL = "E3F3E7"
TOTAL_TEXT = "2F6F4E"
# Stronger green — used for the batch "Total" summary row so it stands out
# from the individual ingredient totals column.
SUBTOTAL_FILL = "A6DFB5"
SUBTOTAL_TEXT = "17492F"
# Warm amber — used for the padtar (final cost per unit) row so it reads
# clearly as the bottom-line number, distinct from the greens above.
PADTAR_FILL = "FBBF77"
PADTAR_TEXT = "6B3410"
NEGATIVE_FILL = "FBE7E7"
NEGATIVE_TEXT = "A13A3A"
NOTES_FILL = "FDF6E3"
# Soft violet — oil-sit sub-table header, so the reader knows it's a
# reconciliation aside, not part of the ingredient table.
OIL_SIT_FILL = "EDE4FD"
OIL_SIT_TEXT = "4A3585"
BORDER_COLOR = "D7DBE0"
