"""Excel + PDF export for Rojmel — two independent exports matching the two
pages in the UI: day entries (sales + cashbook) and monthly stock. Notes get
their own clearly separate section in both formats, same rule as Shakkarpara.
"""

import calendar
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, Table, TableStyle

from app.core.export_style import (
    BORDER_COLOR,
    HEADER_FILL,
    NEGATIVE_FILL,
    NEGATIVE_TEXT,
    PADTAR_FILL,
    PADTAR_TEXT,
    RATE_FILL,
    RATE_TEXT,
    SUBTOTAL_FILL,
    SUBTOTAL_TEXT,
    TOTAL_FILL,
    TOTAL_TEXT,
    USAGE_FILL,
    USAGE_TEXT,
)
from app.core.notes import parse_notes
from app.core.pdf import BODY_STYLE, SECTION_STYLE, new_document, notes_section, spacer, title_block
from app.modules.rojmel.schemas import DayOut, StockRowOut

_thin_side = Side(style="thin", color=BORDER_COLOR)
THIN_BORDER = Border(left=_thin_side, right=_thin_side, top=_thin_side, bottom=_thin_side)


def _fill(hex_color: str) -> PatternFill:
    return PatternFill(start_color=hex_color, end_color=hex_color, fill_type="solid")


def build_days_excel(days: list[DayOut]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Days"
    for idx, width in enumerate([22, 14, 14, 16], start=1):
        ws.column_dimensions[get_column_letter(idx)].width = width

    row = 1
    for day in sorted(days, key=lambda d: d.date):
        ws.cell(row=row, column=1, value="Date").font = Font(bold=True)
        ws.cell(row=row, column=2, value=day.date.strftime("%d %b %Y")).font = Font(bold=True)
        row += 1

        for col, header in enumerate(["Product", "Rate (₹)", "Pic", "Total (₹)"], start=1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill, cell.font, cell.border = _fill(HEADER_FILL), Font(bold=True), THIN_BORDER
        row += 1

        for s in day.sales_lines:
            ws.cell(row=row, column=1, value=s.product).border = THIN_BORDER
            c = ws.cell(row=row, column=2, value=s.rate)
            c.fill, c.font, c.border = _fill(RATE_FILL), Font(color=RATE_TEXT), THIN_BORDER
            c = ws.cell(row=row, column=3, value=s.qty)
            c.fill, c.font, c.border = _fill(USAGE_FILL), Font(color=USAGE_TEXT), THIN_BORDER
            c = ws.cell(row=row, column=4, value=round(s.total, 2))
            c.fill, c.font, c.border = _fill(TOTAL_FILL), Font(color=TOTAL_TEXT, bold=True), THIN_BORDER
            row += 1

        fs_label = ws.cell(row=row, column=1, value="Factory Sales")
        fs_label.fill, fs_label.font = _fill(SUBTOTAL_FILL), Font(color=SUBTOTAL_TEXT, bold=True)
        c = ws.cell(row=row, column=4, value=round(day.factory_sales, 2))
        c.fill, c.font = _fill(SUBTOTAL_FILL), Font(color=SUBTOTAL_TEXT, bold=True)
        row += 2

        if day.income_lines:
            ws.cell(row=row, column=1, value="Income (besides Factory Sales)").font = Font(bold=True, italic=True)
            row += 1
            for col, header in enumerate(["Description", "Amount", "Note"], start=1):
                cell = ws.cell(row=row, column=col, value=header)
                cell.fill, cell.font = _fill(HEADER_FILL), Font(bold=True)
            row += 1
            for m in day.income_lines:
                ws.cell(row=row, column=1, value=m.description)
                ws.cell(row=row, column=2, value=m.amount)
                ws.cell(row=row, column=3, value=m.note)
                row += 1
            row += 1

        if day.expense_lines:
            ws.cell(row=row, column=1, value="Expense").font = Font(bold=True, italic=True)
            row += 1
            for col, header in enumerate(["Description", "Amount", "Note"], start=1):
                cell = ws.cell(row=row, column=col, value=header)
                cell.fill, cell.font = _fill(HEADER_FILL), Font(bold=True)
            row += 1
            for m in day.expense_lines:
                ws.cell(row=row, column=1, value=m.description)
                ws.cell(row=row, column=2, value=m.amount)
                ws.cell(row=row, column=3, value=m.note)
                row += 1
            row += 1

        ws.cell(row=row, column=1, value="Cash on Hand").font = Font(bold=True)
        c = ws.cell(row=row, column=2, value=round(day.cash_on_hand, 2))
        c.fill, c.font = _fill(PADTAR_FILL), Font(color=PADTAR_TEXT, bold=True)
        row += 2

    notes_ws = wb.create_sheet("Notes")
    notes_ws.column_dimensions["A"].width = 16
    notes_ws.column_dimensions["B"].width = 45
    notes_ws.column_dimensions["C"].width = 35
    notes_ws.append(["Date", "Note", "Detail"])
    for cell in notes_ws[1]:
        cell.font, cell.fill = Font(bold=True), _fill(HEADER_FILL)
    for day in sorted(days, key=lambda d: d.date):
        for i, (note, detail) in enumerate(parse_notes(day.notes)):
            notes_ws.append([day.date.strftime("%d %b %Y") if i == 0 else "", note, detail])
            for cell in notes_ws[notes_ws.max_row]:
                cell.alignment = Alignment(wrap_text=True, vertical="top")

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def build_days_pdf(days: list[DayOut]) -> bytes:
    buffer = BytesIO()
    doc = new_document(buffer, "Rojmel")
    story = title_block("Rojmel", "Daily sales & cash export")

    for day in sorted(days, key=lambda d: d.date):
        story.append(Paragraph(f"Day — {day.date.strftime('%d %b %Y')}", SECTION_STYLE))

        rows = [["Product", "Rate (₹)", "Pic", "Total (₹)"]]
        for s in day.sales_lines:
            rows.append([s.product, f"{s.rate:g}", f"{s.qty:g}", f"{s.total:.2f}"])
        rows.append(["Factory Sales", "", "", f"{day.factory_sales:.2f}"])
        n = len(day.sales_lines)
        table = Table(rows, colWidths=[6 * cm, 3 * cm, 3 * cm, 3.5 * cm])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{HEADER_FILL}")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("BACKGROUND", (1, 1), (1, n), colors.HexColor(f"#{RATE_FILL}")),
                    ("BACKGROUND", (2, 1), (2, n), colors.HexColor(f"#{USAGE_FILL}")),
                    ("BACKGROUND", (3, 1), (3, n), colors.HexColor(f"#{TOTAL_FILL}")),
                    # Factory Sales row — stronger green.
                    ("BACKGROUND", (0, n + 1), (-1, n + 1), colors.HexColor(f"#{SUBTOTAL_FILL}")),
                    ("TEXTCOLOR", (0, n + 1), (-1, n + 1), colors.HexColor(f"#{SUBTOTAL_TEXT}")),
                    ("FONTNAME", (0, n + 1), (-1, n + 1), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(f"#{BORDER_COLOR}")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(table)
        story.append(spacer(0.3))

        money_rows = [["Type", "Description", "Amount", "Note"]]
        for m in day.income_lines:
            money_rows.append(["Income", m.description, f"{m.amount:.2f}", m.note])
        for m in day.expense_lines:
            money_rows.append(["Expense", m.description, f"{m.amount:.2f}", m.note])
        if len(money_rows) > 1:
            money_table = Table(money_rows, colWidths=[2.5 * cm, 5 * cm, 3 * cm, 5 * cm])
            money_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{HEADER_FILL}")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(f"#{BORDER_COLOR}")),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            story.append(money_table)
            story.append(spacer(0.3))

        summary = Table(
            [["Total Income", f"{day.total_income:.2f}", "Total Expense", f"{day.total_expense:.2f}", "Cash on Hand", f"{day.cash_on_hand:.2f}"]],
            colWidths=[3 * cm, 2.5 * cm, 3 * cm, 2.5 * cm, 3 * cm, 2.5 * cm],
        )
        summary.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (1, 0), colors.HexColor(f"#{SUBTOTAL_FILL}")),
                    ("TEXTCOLOR", (0, 0), (1, 0), colors.HexColor(f"#{SUBTOTAL_TEXT}")),
                    ("BACKGROUND", (2, 0), (3, 0), colors.HexColor(f"#{NEGATIVE_FILL}")),
                    ("TEXTCOLOR", (2, 0), (3, 0), colors.HexColor(f"#{NEGATIVE_TEXT}")),
                    ("BACKGROUND", (4, 0), (5, 0), colors.HexColor(f"#{PADTAR_FILL}")),
                    ("TEXTCOLOR", (4, 0), (5, 0), colors.HexColor(f"#{PADTAR_TEXT}")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(f"#{BORDER_COLOR}")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(summary)
        story.append(spacer(0.8))

    note_entries = [(d.date.strftime("%d %b %Y"), parse_notes(d.notes)) for d in sorted(days, key=lambda d: d.date) if d.notes]
    story.extend(notes_section(note_entries))

    if not days:
        story.append(Paragraph("No days to export.", BODY_STYLE))

    doc.build(story)
    return buffer.getvalue()


def build_stock_excel(rows: list[StockRowOut], year: int, month: int) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Stock"
    ws.append([f"{calendar.month_name[month]} {year}"])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([])
    headers = ["Product", "Rate", "OPP.PIC (Opening)", "CLO.PIC (Closing)", "NET.PIC (Net)"]
    ws.append(headers)
    for cell in ws[3]:
        cell.font, cell.fill = Font(bold=True), _fill(HEADER_FILL)

    for row in rows:
        ws.append([row.product, row.rate, row.opening_pic, row.closing_pic, row.net_pic])
        net_cell = ws.cell(row=ws.max_row, column=5)
        if row.net_pic < 0:
            net_cell.fill, net_cell.font = _fill(NEGATIVE_FILL), Font(color=NEGATIVE_TEXT, bold=True)
        else:
            net_cell.fill, net_cell.font = _fill(PADTAR_FILL), Font(color=PADTAR_TEXT, bold=True)

    for idx, width in enumerate([20, 12, 16, 16, 14], start=1):
        ws.column_dimensions[get_column_letter(idx)].width = width

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def build_stock_pdf(rows: list[StockRowOut], year: int, month: int) -> bytes:
    buffer = BytesIO()
    doc = new_document(buffer, "Rojmel Stock")
    story = title_block("Rojmel — Stock", f"{calendar.month_name[month]} {year}")

    table_rows = [["Product", "Rate", "Opening", "Closing", "Net"]]
    for row in rows:
        table_rows.append([row.product, f"{row.rate:g}", f"{row.opening_pic:g}", f"{row.closing_pic:g}", f"{row.net_pic:g}"])

    table = Table(table_rows, colWidths=[5 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm])
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{HEADER_FILL}")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(f"#{BORDER_COLOR}")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i, row in enumerate(rows, start=1):
        fill = NEGATIVE_FILL if row.net_pic < 0 else PADTAR_FILL
        style.append(("BACKGROUND", (4, i), (4, i), colors.HexColor(f"#{fill}")))
    table.setStyle(TableStyle(style))
    story.append(table)

    doc.build(story)
    return buffer.getvalue()
