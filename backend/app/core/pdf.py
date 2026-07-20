"""Shared PDF building blocks (reportlab) used by both modules' exporters."""

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import APP_NAME
from app.core.export_style import NOTES_FILL

styles = getSampleStyleSheet()
# Compact by design: the client prints these, and wants a normal entry (table +
# notes) to land on ONE A4 page. Long notes may still spill over — acceptable.
TITLE_STYLE = ParagraphStyle("ExportTitle", parent=styles["Title"], fontSize=15, spaceAfter=2)
SUBTITLE_STYLE = ParagraphStyle("ExportSubtitle", parent=styles["Normal"], fontSize=9, textColor=colors.grey, spaceAfter=8)
SECTION_STYLE = ParagraphStyle("ExportSection", parent=styles["Heading2"], fontSize=12, spaceBefore=8, spaceAfter=4)
BODY_STYLE = ParagraphStyle("ExportBody", parent=styles["Normal"], fontSize=9, leading=11)
NOTE_DATE_STYLE = ParagraphStyle("NoteDate", parent=BODY_STYLE, fontName="Helvetica-Bold")


def new_document(buffer: BytesIO, title: str) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buffer,
        pagesize=A4,
        title=f"{APP_NAME} — {title}",
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )


def title_block(title: str, subtitle: str) -> list:
    return [
        Paragraph(f"{APP_NAME} — {title}", TITLE_STYLE),
        Paragraph(subtitle, SUBTITLE_STYLE),
    ]


def notes_section(entries: list[tuple[str, list[tuple[str, str]]]]) -> list:
    """entries: list of (date_label, note_rows) where note_rows is a list of
    (note, detail) pairs from core.notes.parse_notes. Renders one PDF row per
    note line — its own clearly marked section, never mixed into data tables.

    Columns are Date | Amount | Note: the pair is stored [note, detail] but the
    detail IS the amount, and the client enters/reads the amount first, so it's
    rendered first (right-aligned) here too.
    """
    entries = [(d, rows) for d, rows in entries if rows]
    if not entries:
        return []

    # No PageBreak: notes flow directly under the data so a normal entry stays on
    # one page. They keep their own clearly marked "Notes" heading + block.
    flow: list = [Paragraph("Notes", SECTION_STYLE)]
    rows = []
    for date, note_rows in entries:
        for i, (note, detail) in enumerate(note_rows):
            rows.append([
                Paragraph(date if i == 0 else "", NOTE_DATE_STYLE),
                Paragraph(detail, BODY_STYLE),  # amount
                Paragraph(note, BODY_STYLE),
            ])
    table = Table(rows, colWidths=[3 * cm, 3.4 * cm, 11.4 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(f"#{NOTES_FILL}")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),  # amounts line up
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D7DBE0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.white),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    flow.append(table)
    return flow


def spacer(height: float = 0.5) -> Spacer:
    return Spacer(1, height * cm)
