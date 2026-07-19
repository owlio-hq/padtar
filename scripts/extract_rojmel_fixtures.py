"""Extract every real daily sheet from source_excel/rojmed/*.xlsx into a JSON
fixture the pytest suite asserts the Rojmel formula engine against — the same
cell-for-cell approach used for Shakkarpara (see extract_shakkarpara_fixtures.py).

The layout is identical across all 13 files (confirmed by inspecting the raw
formulas — M20=SUM(B27), M22=SUM(M3:M21), P20=SUM(P3:P19), P21=M22-P20, stock
block at row 28+). Fixed cell map, 1-based rows/cols:

  row 1  B..K : product names            (cols 2..11)
  row 2  B..K : rates
  row 25 B..K : total pic sold (=SUM of the day's entries)   [cached]
  row 26 B..K : total sales = rate*pic                        [cached, expected]
  B27         : factory sales grand total                     [cached, expected]
  M/N/O rows 3-21 (EXCLUDING row 20 = the factory-sales auto cell) : income lines
  P/Q/R rows 3-19 : expense lines
  M22         : total income      [cached, expected]
  P20         : total kharcho     [cached, expected]
  P21         : cash on hand       [cached, expected]
  stock rows 29-38 : D=opening(typed)  E=closing(=pic sold)  F=net(=D-E)  [cached, expected]
  F39         : total net          [cached, expected]

Read-only — never writes to the client's Excel files.
"""

import glob
import json
import os
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "source_excel" / "rojmed"
OUTPUT_JSON = ROOT / "backend" / "tests" / "fixtures" / "rojmel_extracted.json"

PRODUCT_COLS = range(2, 12)  # B..K
COL_OPENING, COL_CLOSING, COL_NET = 4, 5, 6  # D, E, F in the stock block
STOCK_FIRST_ROW = 29  # OPP/CLO/NET rows 29..38
COL_M, COL_N, COL_O = 13, 14, 15  # income amount / description / note
COL_P, COL_Q, COL_R = 16, 17, 18  # expense amount / description / note
FACTORY_SALES_INCOME_ROW = 20  # M20 — auto cell, excluded from income lines


def _num(value) -> float:
    return float(value) if isinstance(value, (int, float)) else 0.0


def _text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def _extract(ws, sheet_name: str) -> dict:
    def cell(r, c):
        return ws.cell(row=r, column=c).value

    products = []
    for i, col in enumerate(PRODUCT_COLS):
        stock_row = STOCK_FIRST_ROW + i
        products.append(
            {
                "name": _text(cell(1, col)) or f"col{col}",
                "rate": _num(cell(2, col)),
                "pic": _num(cell(25, col)),  # total pieces sold that day
                "opening": _num(cell(stock_row, COL_OPENING)),
                "expected_total": _num(cell(26, col)),
                "expected_closing": _num(cell(stock_row, COL_CLOSING)),
                "expected_net": _num(cell(stock_row, COL_NET)),
            }
        )

    # NOTE: only AMOUNTS are captured — descriptions/notes hold the client's real
    # party names and personal payment details, which must never land in this
    # public repo. The engine math depends on amounts alone, so the test is fully
    # exercised without them.
    income = []
    for r in range(3, 22):  # M3:M21 per the SUM formula
        if r == FACTORY_SALES_INCOME_ROW:
            continue  # engine adds factory sales itself
        amount = cell(r, COL_M)
        if isinstance(amount, (int, float)):
            income.append({"amount": float(amount)})

    expense = []
    for r in range(3, 20):  # P3:P19 per the SUM formula
        amount = cell(r, COL_P)
        if isinstance(amount, (int, float)):
            expense.append({"amount": float(amount)})

    return {
        "sheet": sheet_name,
        "products": products,
        "income": income,
        "expense": expense,
        "expected_factory_sales": _num(cell(27, 2)),  # B27
        "expected_total_income": _num(cell(22, COL_M)),  # M22
        "expected_total_expense": _num(cell(20, COL_P)),  # P20
        "expected_cash_on_hand": _num(cell(21, COL_P)),  # P21
        "expected_total_net": _num(cell(39, COL_NET)),  # F39
    }


def main() -> None:
    files = sorted(
        f for f in glob.glob(str(SOURCE_DIR / "*.xlsx")) if not os.path.basename(f).startswith("~$")
    )
    days = []
    for f in files:
        wb = openpyxl.load_workbook(f, data_only=True)  # cached formula results
        ws = wb.active
        days.append(_extract(ws, os.path.basename(f)))

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(days, indent=2))
    print(f"Extracted {len(days)} daily sheets -> {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
