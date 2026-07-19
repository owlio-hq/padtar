"""Cell-for-cell replica test: the Rojmel engine must reproduce every one of the
13 real daily sheets in source_excel/rojmed/ (see scripts/extract_rojmel_fixtures.py),
matching Excel's own cached formula results exactly — no rounding (CLAUDE.md).

Run `python test_rojmel_excel_replica.py` directly to print a human-readable
Excel-vs-App comparison table for all days.
"""

import json
import math
from pathlib import Path

import pytest

from app.modules.rojmel import engine

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "rojmel_extracted.json"
DAYS = json.loads(FIXTURES_PATH.read_text())

# Exact in IEEE double for the integer / half-integer values these sheets hold;
# a whisker of tolerance guards only against harmless sum-ordering representation.
TOL = 1e-9


def _run(day: dict) -> engine.DayResult:
    # CLO.PIC is now a typed input; in the source sheets it equals the pieces sold
    # (Excel's E = SUM of sales), so feed expected_closing → net = opening − closing = F.
    sales = [
        engine.SalesLine(product=p["name"], rate=p["rate"], qty=p["pic"], opening_pic=p["opening"], closing_pic=p["expected_closing"])
        for p in day["products"]
    ]
    # fixtures carry only amounts (descriptions/notes are the client's private data)
    income = [engine.MoneyLine(description="", amount=m["amount"]) for m in day["income"]]
    expense = [engine.MoneyLine(description="", amount=m["amount"]) for m in day["expense"]]
    return engine.compute_day(sales, income, expense)


def _diffs(day: dict) -> list[str]:
    """Return a list of human-readable mismatches for one day (empty = perfect)."""
    result = _run(day)
    out: list[str] = []

    for p, computed in zip(day["products"], result.sales_lines):
        if not math.isclose(computed.total, p["expected_total"], abs_tol=TOL):
            out.append(f"{p['name']} total: app={computed.total} excel={p['expected_total']}")
        if not math.isclose(computed.closing_pic, p["expected_closing"], abs_tol=TOL):
            out.append(f"{p['name']} CLO.PIC: app={computed.closing_pic} excel={p['expected_closing']}")
        if not math.isclose(computed.net_pic, p["expected_net"], abs_tol=TOL):
            out.append(f"{p['name']} NET.PIC: app={computed.net_pic} excel={p['expected_net']}")

    checks = [
        ("factory sales", result.factory_sales, day["expected_factory_sales"]),
        ("total income", result.total_income, day["expected_total_income"]),
        ("total expense", result.total_expense, day["expected_total_expense"]),
        ("cash on hand", result.cash_on_hand, day["expected_cash_on_hand"]),
        ("total net", sum(c.net_pic for c in result.sales_lines), day["expected_total_net"]),
    ]
    for label, app_val, excel_val in checks:
        if not math.isclose(app_val, excel_val, abs_tol=TOL):
            out.append(f"{label}: app={app_val} excel={excel_val}")
    return out


@pytest.mark.parametrize("day", DAYS, ids=[d["sheet"] for d in DAYS])
def test_engine_reproduces_excel(day):
    diffs = _diffs(day)
    assert not diffs, f"{day['sheet']} mismatches:\n  " + "\n  ".join(diffs)


def test_all_days_present():
    assert len(DAYS) == 13


if __name__ == "__main__":
    # Human-readable report: Excel vs App, per day.
    hdr = f"{'sheet':14} {'factory':>10} {'income':>11} {'kharcho':>10} {'cash':>11} {'net':>7}  match"
    print(hdr)
    print("-" * len(hdr))
    total_cells = 0
    ok_cells = 0
    for day in DAYS:
        r = _run(day)
        diffs = _diffs(day)
        # count compared values: 3 per product + 5 day-level
        cells = len(day["products"]) * 3 + 5
        total_cells += cells
        ok_cells += cells - len(diffs)
        mark = "OK" if not diffs else f"✗ {len(diffs)}"
        print(f"{day['sheet']:14} {r.factory_sales:>10g} {r.total_income:>11g} {r.total_expense:>10g} {r.cash_on_hand:>11g} {sum(c.net_pic for c in r.sales_lines):>7g}  {mark}")
        for d in diffs:
            print(f"    ! {d}")
    print("-" * len(hdr))
    print(f"Days: {len(DAYS)}   Values matched: {ok_cells}/{total_cells}")
    print("VERDICT:", "PERFECT — app == Excel on every number" if ok_cells == total_cells else "MISMATCHES FOUND (see above)")
