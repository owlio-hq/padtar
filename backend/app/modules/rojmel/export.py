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
    fit_to_one_page,
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


def _money_table(title: str, lines, head_fill: str, head_text: str) -> Table:
    """One PDF money table (Income or Kharcho) with a coloured header row.
    Columns are Amount | Description | Note, matching the on-screen order; the
    block name sits over the wide description column."""
    rows = [["Amount", title, "Note"]]
    for m in lines:
        rows.append([f"{m.amount:.2f}", m.description, m.note])
    if len(rows) == 1:
        rows.append(["", "—", ""])
    tbl = Table(rows, colWidths=[2.0 * cm, 4.2 * cm, 2.6 * cm])
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{head_fill}")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor(f"#{head_text}")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(f"#{BORDER_COLOR}")),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (0, 0), (0, -1), "RIGHT"),  # amounts line up
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    return tbl


def build_days_excel(days: list[DayOut]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Days"
    # widths: Product | Rate | Sales | OPP.PIC | CLO.PIC | NET.PIC | Total
    for idx, width in enumerate([22, 12, 10, 11, 11, 11, 14], start=1):
        ws.column_dimensions[get_column_letter(idx)].width = width

    row = 1
    for day in sorted(days, key=lambda d: d.date):
        ws.cell(row=row, column=1, value="Date").font = Font(bold=True)
        ws.cell(row=row, column=2, value=day.date.strftime("%d %b %Y")).font = Font(bold=True)
        row += 1

        # Column order: Product | Rate | Sales | OPP.PIC | CLO.PIC | NET.PIC | Total
        for col, header in enumerate(["Product", "Rate (₹)", "Sales", "OPP.PIC", "CLO.PIC", "NET.PIC", "Total (₹)"], start=1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill, cell.font, cell.border = _fill(HEADER_FILL), Font(bold=True), THIN_BORDER
        row += 1

        right, center = Alignment(horizontal="right"), Alignment(horizontal="center")
        for s in day.sales_lines:
            ws.cell(row=row, column=1, value=s.product).border = THIN_BORDER
            c = ws.cell(row=row, column=2, value=s.rate)
            c.fill, c.font, c.border, c.alignment = _fill(RATE_FILL), Font(color=RATE_TEXT), THIN_BORDER, center
            c = ws.cell(row=row, column=3, value=s.qty)
            c.fill, c.font, c.border, c.alignment = _fill(USAGE_FILL), Font(color=USAGE_TEXT), THIN_BORDER, right
            # OPP.PIC (opening) / CLO.PIC (closing) / NET.PIC (opening−closing, red when negative)
            for col, val in ((4, s.opening_pic), (5, s.closing_pic)):
                c = ws.cell(row=row, column=col, value=val)
                c.border, c.alignment = THIN_BORDER, right
            net_cell = ws.cell(row=row, column=6, value=s.net_pic)
            fill, text = (NEGATIVE_FILL, NEGATIVE_TEXT) if s.net_pic < 0 else (TOTAL_FILL, TOTAL_TEXT)
            net_cell.fill, net_cell.font, net_cell.border = _fill(fill), Font(color=text, bold=True), THIN_BORDER
            net_cell.alignment = right
            c = ws.cell(row=row, column=7, value=round(s.total, 2))
            c.fill, c.font, c.border, c.alignment = _fill(TOTAL_FILL), Font(color=TOTAL_TEXT, bold=True), THIN_BORDER, right
            row += 1

        fs_label = ws.cell(row=row, column=1, value="Factory Sales")
        fs_label.fill, fs_label.font = _fill(SUBTOTAL_FILL), Font(color=SUBTOTAL_TEXT, bold=True)
        c = ws.cell(row=row, column=7, value=round(day.factory_sales, 2))
        c.fill, c.font = _fill(SUBTOTAL_FILL), Font(color=SUBTOTAL_TEXT, bold=True)
        row += 2

        # Amount | Description | Note — same order as the screen, amounts right.
        for label, money_lines in (("Income", day.income_lines), ("Kharcho", day.expense_lines)):
            if not money_lines:
                continue
            ws.cell(row=row, column=1, value=label).font = Font(bold=True, italic=True)
            row += 1
            for col, header in enumerate(["Amount (₹)", "Description", "Note"], start=1):
                cell = ws.cell(row=row, column=col, value=header)
                cell.fill, cell.font = _fill(HEADER_FILL), Font(bold=True)
            row += 1
            for m in money_lines:
                amt = ws.cell(row=row, column=1, value=m.amount)
                amt.alignment = Alignment(horizontal="right")
                ws.cell(row=row, column=2, value=m.description)
                ws.cell(row=row, column=3, value=m.note)
                row += 1
            row += 1

        ws.cell(row=row, column=1, value="Cash on Hand").font = Font(bold=True)
        c = ws.cell(row=row, column=2, value=round(day.cash_on_hand, 2))
        c.fill, c.font = _fill(PADTAR_FILL), Font(color=PADTAR_TEXT, bold=True)
        row += 2

        if day.carry_forward_lines:
            ws.cell(row=row, column=1, value="Carry Forward").font = Font(bold=True, italic=True)
            row += 1
            for col, header in enumerate(["Name", "Carry Forward (₹)"], start=1):
                cell = ws.cell(row=row, column=col, value=header)
                cell.fill, cell.font = _fill(HEADER_FILL), Font(bold=True)
            row += 1
            for cf in day.carry_forward_lines:
                ws.cell(row=row, column=1, value=cf.name)
                ws.cell(row=row, column=2, value=cf.amount)
                row += 1
            row += 1

    # Date | Amount | Note — the stored pair is [note, detail] but detail IS the
    # amount, and the client reads the amount first.
    notes_ws = wb.create_sheet("Notes")
    notes_ws.column_dimensions["A"].width = 16
    notes_ws.column_dimensions["B"].width = 16
    notes_ws.column_dimensions["C"].width = 60
    notes_ws.append(["Date", "Amount", "Note"])
    for cell in notes_ws[1]:
        cell.font, cell.fill = Font(bold=True), _fill(HEADER_FILL)
    for day in sorted(days, key=lambda d: d.date):
        for i, (note, detail) in enumerate(parse_notes(day.notes)):
            notes_ws.append([day.date.strftime("%d %b %Y") if i == 0 else "", detail, note])
            for cell in notes_ws[notes_ws.max_row]:
                cell.alignment = Alignment(wrap_text=True, vertical="top")
            notes_ws.cell(row=notes_ws.max_row, column=2).alignment = Alignment(horizontal="right", vertical="top")

    fit_to_one_page(ws)
    fit_to_one_page(notes_ws)

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def build_days_pdf(days: list[DayOut]) -> bytes:
    buffer = BytesIO()
    doc = new_document(buffer, "Rojmel")
    story = title_block("Rojmel", "Daily sales & cash export")

    for day in sorted(days, key=lambda d: d.date):
        story.append(Paragraph(f"Day — {day.date.strftime('%d %b %Y')}", SECTION_STYLE))

        # PDF uses Helvetica, which has no ₹ glyph (renders as a black box) — use "Rs."
        # Column order: Product | Rate | Sales | OPP.PIC | CLO.PIC | NET.PIC | Total
        rows = [["Product", "Rate (Rs.)", "Sales", "OPP.PIC", "CLO.PIC", "NET.PIC", "Total (Rs.)"]]
        for s in day.sales_lines:
            rows.append([s.product, f"{s.rate:g}", f"{s.qty:g}", f"{s.opening_pic:g}", f"{s.closing_pic:g}", f"{s.net_pic:g}", f"{s.total:.2f}"])
        rows.append(["Factory Sales", "", "", "", "", "", f"{day.factory_sales:.2f}"])
        n = len(day.sales_lines)
        table = Table(rows, colWidths=[4.4 * cm, 2 * cm, 1.7 * cm, 1.9 * cm, 1.9 * cm, 1.9 * cm, 2.6 * cm])
        style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{HEADER_FILL}")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BACKGROUND", (1, 1), (1, n), colors.HexColor(f"#{RATE_FILL}")),
            ("BACKGROUND", (2, 1), (2, n), colors.HexColor(f"#{USAGE_FILL}")),
            ("BACKGROUND", (6, 1), (6, n), colors.HexColor(f"#{TOTAL_FILL}")),
            # Factory Sales row — stronger green.
            ("BACKGROUND", (0, n + 1), (-1, n + 1), colors.HexColor(f"#{SUBTOTAL_FILL}")),
            ("TEXTCOLOR", (0, n + 1), (-1, n + 1), colors.HexColor(f"#{SUBTOTAL_TEXT}")),
            ("FONTNAME", (0, n + 1), (-1, n + 1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(f"#{BORDER_COLOR}")),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            # amounts/counts right, rate centred, product name left
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ]
        # NET.PIC cell red when negative, green otherwise (col index 5).
        for i, s in enumerate(day.sales_lines, start=1):
            fill, text = (NEGATIVE_FILL, NEGATIVE_TEXT) if s.net_pic < 0 else (TOTAL_FILL, TOTAL_TEXT)
            style.append(("BACKGROUND", (5, i), (5, i), colors.HexColor(f"#{fill}")))
            style.append(("TEXTCOLOR", (5, i), (5, i), colors.HexColor(f"#{text}")))
        table.setStyle(TableStyle(style))
        story.append(table)
        story.append(spacer(0.2))

        # Two separate money tables, side by side, matching the UI: Income (green
        # header) on the left, Kharcho (red header) on the right.
        income_tbl = _money_table("Income", day.income_lines, SUBTOTAL_FILL, SUBTOTAL_TEXT)
        expense_tbl = _money_table("Kharcho", day.expense_lines, NEGATIVE_FILL, NEGATIVE_TEXT)
        pair = Table([[income_tbl, expense_tbl]], colWidths=[9 * cm, 9 * cm])
        pair.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (0, 0), 6)]))
        story.append(pair)
        story.append(spacer(0.2))

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
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                ]
            )
        )
        story.append(summary)
        story.append(spacer(0.2))

        if day.carry_forward_lines:
            cf_rows = [["Carry Forward", "Amount (Rs.)"]]
            for cf in day.carry_forward_lines:
                cf_rows.append([cf.name, f"{cf.amount:g}"])
            cf_table = Table(cf_rows, colWidths=[8 * cm, 4 * cm])
            cf_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{HEADER_FILL}")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(f"#{BORDER_COLOR}")),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                    ]
                )
            )
            story.append(cf_table)
        story.append(spacer(0.4))

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

    fit_to_one_page(ws)

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
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]
    for i, row in enumerate(rows, start=1):
        fill = NEGATIVE_FILL if row.net_pic < 0 else PADTAR_FILL
        style.append(("BACKGROUND", (4, i), (4, i), colors.HexColor(f"#{fill}")))
    table.setStyle(TableStyle(style))
    story.append(table)

    doc.build(story)
    return buffer.getvalue()
