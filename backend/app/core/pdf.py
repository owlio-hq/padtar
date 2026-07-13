"""Shared PDF building blocks (reportlab) used by both modules' exporters."""

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import APP_NAME
from app.core.export_style import NOTES_FILL

styles = getSampleStyleSheet()
TITLE_STYLE = ParagraphStyle("ExportTitle", parent=styles["Title"], fontSize=18, spaceAfter=4)
SUBTITLE_STYLE = ParagraphStyle("ExportSubtitle", parent=styles["Normal"], textColor=colors.grey, spaceAfter=16)
SECTION_STYLE = ParagraphStyle("ExportSection", parent=styles["Heading2"], spaceBefore=14, spaceAfter=6)
BODY_STYLE = styles["Normal"]
NOTE_DATE_STYLE = ParagraphStyle("NoteDate", parent=styles["Normal"], fontName="Helvetica-Bold")


def new_document(buffer: BytesIO, title: str) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buffer,
        pagesize=A4,
        title=f"{APP_NAME} — {title}",
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )


def title_block(title: str, subtitle: str) -> list:
    return [
        Paragraph(f"{APP_NAME} — {title}", TITLE_STYLE),
        Paragraph(subtitle, SUBTITLE_STYLE),
    ]


def notes_section(entries: list[tuple[str, str]]) -> list:
    """entries: list of (date_label, note_text). Renders as its own clearly
    marked section — notes are never mixed into the data tables."""
    if not entries:
        return []

    flow: list = [PageBreak(), Paragraph("Notes", SECTION_STYLE)]
    rows = [[Paragraph(date, NOTE_DATE_STYLE), Paragraph(note, BODY_STYLE)] for date, note in entries]
    table = Table(rows, colWidths=[3 * cm, 14 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(f"#{NOTES_FILL}")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D7DBE0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.white),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    flow.append(table)
    return flow


def spacer(height: float = 0.5) -> Spacer:
    return Spacer(1, height * cm)
