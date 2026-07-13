"""Standalone formula engine for Rojmel (daily sales + cashbook + stock).

Pure functions only — no DB, no I/O. Mirrors the original Excel formulas
exactly (see docs/FILE2-ANALYSIS.md):
    sales line total = rate * qty                        (Excel: =rate*qty)
    factory sales     = sum of all sales line totals       (Excel: =SUM(B26:K26))
    total income      = factory sales + other income lines
    total expense     = sum of expense lines               (Excel: totalkharcho)
    cash on hand      = total income - total expense       (Excel: cash o hand)
    net stock         = opening pieces - closing pieces     (Excel: NET.PIC, can go negative)

All arithmetic uses native Python floats (IEEE-754 double), same as Excel.
"""

from dataclasses import dataclass


@dataclass
class SalesLine:
    product: str
    rate: float
    qty: float


@dataclass
class MoneyLine:
    description: str
    amount: float
    note: str = ""


@dataclass
class ComputedSalesLine:
    product: str
    rate: float
    qty: float
    total: float


@dataclass
class DayResult:
    sales_lines: list[ComputedSalesLine]
    factory_sales: float
    total_income: float
    total_expense: float
    cash_on_hand: float


def sales_line_total(rate: float, qty: float) -> float:
    return rate * qty


def compute_day(sales_lines: list[SalesLine], income_lines: list[MoneyLine], expense_lines: list[MoneyLine]) -> DayResult:
    computed_sales = [ComputedSalesLine(s.product, s.rate, s.qty, sales_line_total(s.rate, s.qty)) for s in sales_lines]

    factory_sales = 0.0
    for line in computed_sales:
        factory_sales += line.total

    total_income = factory_sales
    for line in income_lines:
        total_income += line.amount

    total_expense = 0.0
    for line in expense_lines:
        total_expense += line.amount

    cash_on_hand = total_income - total_expense

    return DayResult(
        sales_lines=computed_sales,
        factory_sales=factory_sales,
        total_income=total_income,
        total_expense=total_expense,
        cash_on_hand=cash_on_hand,
    )


def net_pic(opening_pic: float, closing_pic: float) -> float:
    # intentionally allowed to go negative — used by the client to catch unrecorded entries
    return opening_pic - closing_pic
