"""Rojmel engine — stock columns and cashbook math.

OPP.PIC (morning) and CLO.PIC (evening) are both typed by the owner;
NET.PIC = OPP.PIC − CLO.PIC (can go negative). Sales (pieces) drives revenue
only — it never touches the stock net.
"""

from app.modules.rojmel import engine


def _sales(*rows):
    # rows are (rate, qty, opening_pic, closing_pic)
    return [
        engine.SalesLine(product=f"p{i}", rate=r, qty=q, opening_pic=o, closing_pic=c)
        for i, (r, q, o, c) in enumerate(rows)
    ]


def test_closing_pic_is_the_typed_value():
    result = engine.compute_day(_sales((40, 3, 10, 6)), [], [])
    assert result.sales_lines[0].closing_pic == 6  # echoed straight back, not derived


def test_net_pic_is_opening_minus_closing():
    result = engine.compute_day(_sales((40, 3, 10, 6)), [], [])
    assert result.sales_lines[0].net_pic == 4  # 10 opening - 6 closing


def test_net_pic_can_go_negative():
    # closing counted higher than opening — intentional, flags an unrecorded entry
    result = engine.compute_day(_sales((40, 3, 6, 10)), [], [])
    assert result.sales_lines[0].net_pic == -4


def test_net_pic_zero_when_counts_match():
    result = engine.compute_day(_sales((40, 3, 6, 6)), [], [])
    assert result.sales_lines[0].net_pic == 0


def test_stock_fields_default_to_zero():
    result = engine.compute_day([engine.SalesLine(product="x", rate=10, qty=2)], [], [])
    line = result.sales_lines[0]
    assert line.opening_pic == 0
    assert line.closing_pic == 0
    assert line.net_pic == 0


def test_sales_qty_does_not_affect_net():
    # Sales (qty) drives revenue only; net depends solely on opening/closing counts
    result = engine.compute_day(_sales((40, 99, 10, 6)), [], [])
    line = result.sales_lines[0]
    assert line.total == 40 * 99
    assert line.net_pic == 4  # unaffected by the 99 sales


def test_stock_columns_do_not_affect_money_totals():
    income = [engine.MoneyLine("carry", 100.0)]
    expense = [engine.MoneyLine("kharcho", 30.0)]
    result = engine.compute_day(_sales((40, 3, 999, 111), (50, 2, 999, 111)), income, expense)
    assert result.factory_sales == 40 * 3 + 50 * 2  # 220
    assert result.total_income == 220 + 100
    assert result.total_expense == 30
    assert result.cash_on_hand == 220 + 100 - 30
