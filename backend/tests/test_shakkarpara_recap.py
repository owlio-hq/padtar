"""The "last N batches" reference strip (GET /api/shakkarpara/batches/recap).

Read-only glance data shown while entering a batch. The rule that actually matters
here: the two oil rows carry SEPARATE rates. Only Oil Vaprayel's *usage* is derived
(from the Oil Sheet) — its rate is typed independently, and in the client's real
history the two differ on ~27% of sheets. Picking the wrong row would quietly show a
number that doesn't match their own sheet, so it is pinned down below.
"""

from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.modules.shakkarpara.models import Batch, BatchIngredient
from app.modules.shakkarpara.router import get_batch_recap


def _session(tmp_path, name):
    temp_engine = create_engine(f"sqlite:///{tmp_path / name}")
    Base.metadata.create_all(bind=temp_engine)
    return sessionmaker(bind=temp_engine)


def _batch(on, *, production=0.0, extra=0.0, rows=()):
    """rows: (name, rate, usage, is_oil_vaprayel)"""
    b = Batch(date=on, production_qty=production, extra_per_unit=extra)
    for i, (name, rate, usage, is_oil) in enumerate(rows):
        b.ingredients.append(
            BatchIngredient(name=name, rate=rate, usage=usage, unit="", sort_order=i, is_oil_vaprayel=is_oil)
        )
    return b


def test_recap_reads_the_five_tracked_numbers(tmp_path):
    Session = _session(tmp_path, "recap.db")
    s = Session()
    s.add(
        _batch(
            date(2025, 11, 26),
            production=728.15,
            rows=[
                ("Oil", 2010, 1, False),
                ("Oil Vaprayel", 2010, 1, True),
                ("Menda", 1000, 15, False),  # menda katta = the Vaprash on this row
                ("Sugar", 43, 20, False),
            ],
        )
    )
    s.commit()

    row = get_batch_recap(limit=10, exclude_id=None, db=s)[0]
    assert row.menda_rate == 1000       # "menda rate is 1000/katta"
    assert row.menda_katta == 15        # "15 in that day so 15 katta"
    assert row.oil_rate == 2010
    assert row.oil_vaprayel_rate == 2010
    assert row.production_qty == 728.15
    assert row.padtar is not None
    s.close()


def test_recap_keeps_the_two_oil_rates_apart(tmp_path):
    # the real sheets differ (e.g. 2024-09-19: oil 2200 vs oil vaprayel 2100)
    Session = _session(tmp_path, "oil.db")
    s = Session()
    s.add(
        _batch(
            date(2024, 9, 19),
            production=100,
            rows=[("Oil", 2200, 1, False), ("Oil Vaprayel", 2100, 1, True), ("Menda", 1150, 12, False)],
        )
    )
    s.commit()

    row = get_batch_recap(limit=10, exclude_id=None, db=s)[0]
    assert row.oil_rate == 2200
    assert row.oil_vaprayel_rate == 2100
    s.close()


def test_recap_identifies_oil_vaprayel_by_flag_not_name(tmp_path):
    # the flag is the reliable marker — a renamed vaprayel row must still be picked
    Session = _session(tmp_path, "flag.db")
    s = Session()
    s.add(
        _batch(
            date(2024, 9, 19),
            production=100,
            rows=[("oil ret", 2200, 1, False), ("Oil Used", 2100, 1, True)],
        )
    )
    s.commit()

    row = get_batch_recap(limit=10, exclude_id=None, db=s)[0]
    assert row.oil_rate == 2200
    assert row.oil_vaprayel_rate == 2100
    s.close()


def test_recap_is_newest_first_and_respects_limit(tmp_path):
    Session = _session(tmp_path, "order.db")
    s = Session()
    for day in range(1, 16):
        s.add(_batch(date(2025, 3, day), production=100, rows=[("Menda", 900 + day, 10, False)]))
    s.commit()

    rows = get_batch_recap(limit=10, exclude_id=None, db=s)
    assert len(rows) == 10
    assert rows[0].date == date(2025, 3, 15)   # newest first
    assert rows[-1].date == date(2025, 3, 6)
    s.close()


def test_recap_excludes_the_batch_being_edited(tmp_path):
    Session = _session(tmp_path, "exclude.db")
    s = Session()
    a = _batch(date(2025, 3, 1), production=100, rows=[("Menda", 900, 10, False)])
    b = _batch(date(2025, 3, 2), production=100, rows=[("Menda", 950, 11, False)])
    s.add_all([a, b])
    s.commit()

    rows = get_batch_recap(limit=10, exclude_id=b.id, db=s)
    assert [r.id for r in rows] == [a.id]
    s.close()


def test_recap_reports_missing_rows_as_none_not_zero(tmp_path):
    # a renamed/absent ingredient must read as "no value", never as a real 0
    Session = _session(tmp_path, "missing.db")
    s = Session()
    s.add(_batch(date(2025, 3, 1), production=100, rows=[("Sugar", 43, 20, False)]))
    s.commit()

    row = get_batch_recap(limit=10, exclude_id=None, db=s)[0]
    assert row.oil_rate is None
    assert row.oil_vaprayel_rate is None
    assert row.menda_rate is None
    assert row.menda_katta is None
    assert row.production_qty == 100
    s.close()


def test_recap_padtar_matches_the_engine(tmp_path):
    Session = _session(tmp_path, "padtar.db")
    s = Session()
    # total = 100*2 + 50*4 = 400; padtar = 400/100 + 10 = 14
    s.add(
        _batch(
            date(2025, 3, 1),
            production=100,
            extra=10,
            rows=[("Menda", 100, 2, False), ("Sugar", 50, 4, False)],
        )
    )
    s.commit()

    assert get_batch_recap(limit=10, exclude_id=None, db=s)[0].padtar == 14.0
    s.close()


def test_recap_with_no_batches_is_empty(tmp_path):
    Session = _session(tmp_path, "none.db")
    s = Session()
    assert get_batch_recap(limit=10, exclude_id=None, db=s) == []
    s.close()
