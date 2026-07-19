"""Rojmel persistence: the v3->v4 additive migration and the new line types.

These guard the exact "will a client on v3 upgrade cleanly" concern — the new
opening_pic column must be added to an existing DB without touching old rows,
and carry-forward lines must round-trip and cascade-delete with their day.
"""

from datetime import date

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

import app.db as db
from app.db import Base, _ADDITIVE_COLUMNS, _apply_additive_migrations
from app.modules.rojmel.models import RojmelCarryForwardLine, RojmelDay, RojmelSalesLine


def test_migration_declares_opening_pic():
    # the release must ship the migration, or a v3 DB gets "no such column"
    assert ("rojmel_sales_lines", "opening_pic", "FLOAT NOT NULL DEFAULT 0.0") in _ADDITIVE_COLUMNS


def test_additive_migration_adds_opening_pic_to_existing_rows(tmp_path, monkeypatch):
    """Simulate a v3 DB (no opening_pic), run the migration, check old rows read 0."""
    db_file = tmp_path / "legacy.db"
    temp_engine = create_engine(f"sqlite:///{db_file}")

    # build a legacy-shaped table WITHOUT opening_pic, with one existing row
    with temp_engine.begin() as conn:
        conn.execute(text("CREATE TABLE rojmel_days (id INTEGER PRIMARY KEY, date DATE)"))
        conn.execute(
            text(
                "CREATE TABLE rojmel_sales_lines "
                "(id INTEGER PRIMARY KEY, day_id INTEGER, product VARCHAR, rate FLOAT, qty FLOAT, sort_order INTEGER)"
            )
        )
        conn.execute(text("INSERT INTO rojmel_days (id, date) VALUES (1, '2026-07-01')"))
        conn.execute(
            text("INSERT INTO rojmel_sales_lines (id, day_id, product, rate, qty, sort_order) VALUES (1, 1, '200g', 40, 3, 0)")
        )

    # point the real migration function at our temp engine and run it
    monkeypatch.setattr(db, "engine", temp_engine)
    _apply_additive_migrations()

    cols = {c["name"] for c in inspect(temp_engine).get_columns("rojmel_sales_lines")}
    assert "opening_pic" in cols
    with temp_engine.connect() as conn:
        val = conn.execute(text("SELECT opening_pic FROM rojmel_sales_lines WHERE id = 1")).scalar()
    assert val == 0  # existing row defaulted, data intact


def test_migration_backfills_closing_pic_from_qty(tmp_path, monkeypatch):
    """closing_pic used to be derived from qty; upgrading must backfill it so an
    existing day's NET.PIC (= opening − closing) does not silently change."""
    assert ("rojmel_sales_lines", "closing_pic", "FLOAT NOT NULL DEFAULT 0.0") in _ADDITIVE_COLUMNS
    db_file = tmp_path / "legacy_closing.db"
    temp_engine = create_engine(f"sqlite:///{db_file}")
    with temp_engine.begin() as conn:
        conn.execute(text("CREATE TABLE rojmel_days (id INTEGER PRIMARY KEY, date DATE)"))
        # v-with-opening but no closing_pic yet
        conn.execute(
            text(
                "CREATE TABLE rojmel_sales_lines "
                "(id INTEGER PRIMARY KEY, day_id INTEGER, product VARCHAR, rate FLOAT, qty FLOAT, opening_pic FLOAT, sort_order INTEGER)"
            )
        )
        conn.execute(text("INSERT INTO rojmel_days (id, date) VALUES (1, '2026-07-01')"))
        conn.execute(text("INSERT INTO rojmel_sales_lines VALUES (1, 1, '200g', 40, 7, 10, 0)"))

    monkeypatch.setattr(db, "engine", temp_engine)
    _apply_additive_migrations()

    with temp_engine.connect() as conn:
        closing = conn.execute(text("SELECT closing_pic FROM rojmel_sales_lines WHERE id = 1")).scalar()
    assert closing == 7  # backfilled from qty, so net stays 10 − 7 = 3


def test_additive_migration_is_idempotent(tmp_path, monkeypatch):
    db_file = tmp_path / "current.db"
    temp_engine = create_engine(f"sqlite:///{db_file}")
    Base.metadata.create_all(bind=temp_engine)  # already has opening_pic
    monkeypatch.setattr(db, "engine", temp_engine)
    _apply_additive_migrations()  # must not raise "duplicate column"
    _apply_additive_migrations()


def test_carry_forward_and_opening_round_trip(tmp_path):
    db_file = tmp_path / "roundtrip.db"
    temp_engine = create_engine(f"sqlite:///{db_file}")
    Base.metadata.create_all(bind=temp_engine)
    Session = sessionmaker(bind=temp_engine)

    session = Session()
    day = RojmelDay(date=date(2026, 7, 1))
    day.sales_lines.append(RojmelSalesLine(product="200g", rate=40, qty=3, opening_pic=10, closing_pic=6, sort_order=0))
    day.carry_forward_lines.append(RojmelCarryForwardLine(name="Chirag bhai", amount=9550, sort_order=0))
    day.carry_forward_lines.append(RojmelCarryForwardLine(name="Chetna ben", amount=6420, sort_order=1))
    session.add(day)
    session.commit()
    day_id = day.id
    session.close()

    session = Session()
    loaded = session.get(RojmelDay, day_id)
    assert loaded.sales_lines[0].opening_pic == 10
    assert loaded.sales_lines[0].closing_pic == 6
    assert [(c.name, c.amount) for c in loaded.carry_forward_lines] == [("Chirag bhai", 9550), ("Chetna ben", 6420)]

    # deleting the day cascades to carry-forward lines (FK ON via mapper cascade)
    session.delete(loaded)
    session.commit()
    assert session.query(RojmelCarryForwardLine).count() == 0
    session.close()
