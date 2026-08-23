"""Rojmel engine — stock columns and cashbook math.

OPP.PIC (morning) is typed by the owner; CLO.PIC is auto-derived from sales
(= qty). NET.PIC = OPP.PIC − CLO.PIC (can go negative).
"""

from app.modules.rojmel import engine


def _sales(*rows):
    # rows are (rate, qty, opening_pic, closing_pic)
    return [
        engine.SalesLine(product=f"p{i}", rate=r, qty=q, opening_pic=o, closing_pic=c)
        for i, (r, q, o, c) in enumerate(rows)
    ]


def test_closing_pic_equals_qty():
    result = engine.compute_day(_sales((40, 3, 10, 6)), [], [])
    assert result.sales_lines[0].closing_pic == 3  # CLO.PIC = qty (sales), not the typed 6


def test_net_pic_is_opening_minus_sales():
    result = engine.compute_day(_sales((40, 3, 10, 6)), [], [])
    assert result.sales_lines[0].net_pic == 7  # 10 opening - 3 sales


def test_net_pic_can_go_negative():
    result = engine.compute_day(_sales((40, 15, 8, 0)), [], [])
    assert result.sales_lines[0].net_pic == -7  # 8 opening - 15 sales


def test_net_pic_zero_when_sales_equals_opening():
    result = engine.compute_day(_sales((40, 6, 6, 0)), [], [])
    assert result.sales_lines[0].net_pic == 0


def test_stock_fields_default_to_zero():
    result = engine.compute_day([engine.SalesLine(product="x", rate=10, qty=2)], [], [])
    line = result.sales_lines[0]
    assert line.opening_pic == 0
    assert line.closing_pic == 2  # CLO.PIC = qty
    assert line.net_pic == -2  # 0 opening - 2 sales


def test_net_pic_reflects_sales_qty():
    result = engine.compute_day(_sales((40, 5, 25, 0)), [], [])
    line = result.sales_lines[0]
    assert line.closing_pic == 5
    assert line.net_pic == 20  # 25 opening - 5 sales


def test_stock_columns_do_not_affect_money_totals():
    income = [engine.MoneyLine("carry", 100.0)]
    expense = [engine.MoneyLine("kharcho", 30.0)]
    result = engine.compute_day(_sales((40, 3, 999, 111), (50, 2, 999, 111)), income, expense)
    assert result.factory_sales == 40 * 3 + 50 * 2  # 220
    assert result.total_income == 220 + 100
    assert result.total_expense == 30
    assert result.cash_on_hand == 220 + 100 - 30
