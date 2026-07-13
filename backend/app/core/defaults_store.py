"""Editable defaults store — seeds and reads the per-module default tables.

Defaults for a new batch's ingredients and a new day's products used to be
hardcoded lists. They now live in DB tables so the "set as default" edit flow
(edit-password protected) can change them at runtime. These helpers seed the
tables from the hardcoded seed lists on an empty DB, and read them back.
"""

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.modules.rojmel.defaults import DEFAULT_PRODUCTS as SEED_PRODUCTS
from app.modules.rojmel.models import RojmelDefaultProduct
from app.modules.shakkarpara.defaults import DEFAULT_INGREDIENTS as SEED_INGREDIENTS
from app.modules.shakkarpara.models import DefaultIngredient


def seed_defaults() -> None:
    db: Session = SessionLocal()
    try:
        existing = db.query(DefaultIngredient).all()
        if not existing:
            for idx, row in enumerate(SEED_INGREDIENTS):
                db.add(
                    DefaultIngredient(
                        name=row["name"],
                        category=row["category"],
                        rate=row.get("rate", 0.0),
                        unit=row["unit"],
                        sort_order=idx,
                        is_oil_vaprayel=row["is_oil_vaprayel"],
                    )
                )
        elif all(r.rate == 0 for r in existing):
            # One-time fix: an earlier build seeded all default rates as 0. Fill in the
            # real rates by name so existing DBs get them without a wipe. Only runs while
            # every rate is still 0 — never clobbers rates the user has since set.
            by_name = {row["name"]: row.get("rate", 0.0) for row in SEED_INGREDIENTS}
            for r in existing:
                if r.name in by_name:
                    r.rate = by_name[r.name]
        if db.query(RojmelDefaultProduct).count() == 0:
            for idx, row in enumerate(SEED_PRODUCTS):
                db.add(RojmelDefaultProduct(name=row["name"], rate=row["rate"], sort_order=idx))
        db.commit()
        _apply_display_renames(db)
    finally:
        db.close()


# Display-name cleanups requested after client review. Idempotent — plain UPDATEs
# that only touch rows still carrying the old spelling. Labels only, never math.
_UNIT_RENAMES = {
    "kg ma": "Kg",
    "Kg Ma": "Kg",
    "lot bandhta": "Lot Bandhta",
    "katta": "Katta",
    "gram": "Gram",
    "pic": "Pic",
    "potli": "Potli",
    "dabba": "Dabba",
    "per day": "Per Day",
}
_PRODUCT_RENAMES = {
    "200g Salted Wafer": "Salted Wafer 200g",
    "200g Masala": "Masala 200g",
    "500g Salted Wafer": "Salted Wafer 500g",
    "50g Salted Wafer": "Salted Wafer 50g",
}


def _apply_display_renames(db: Session) -> None:
    from sqlalchemy import text

    for old, new in _UNIT_RENAMES.items():
        db.execute(text("UPDATE shakkarpara_batch_ingredients SET unit = :new WHERE unit = :old"), {"new": new, "old": old})
        db.execute(text("UPDATE shakkarpara_default_ingredients SET unit = :new WHERE unit = :old"), {"new": new, "old": old})
    for old, new in _PRODUCT_RENAMES.items():
        db.execute(text("UPDATE rojmel_default_products SET name = :new WHERE name = :old"), {"new": new, "old": old})
        db.execute(text("UPDATE rojmel_sales_lines SET product = :new WHERE product = :old"), {"new": new, "old": old})
        db.execute(text("UPDATE rojmel_stock SET product = :new WHERE product = :old"), {"new": new, "old": old})
    db.commit()


def get_default_ingredients(db: Session) -> list[dict]:
    rows = db.query(DefaultIngredient).order_by(DefaultIngredient.sort_order, DefaultIngredient.id).all()
    return [
        {
            "name": r.name,
            "category": r.category,
            "rate": r.rate,
            "usage": 0.0,
            "unit": r.unit,
            "is_oil_vaprayel": r.is_oil_vaprayel,
        }
        for r in rows
    ]


def get_default_products(db: Session) -> list[dict]:
    rows = db.query(RojmelDefaultProduct).order_by(RojmelDefaultProduct.sort_order, RojmelDefaultProduct.id).all()
    return [{"name": r.name, "rate": r.rate, "qty": 0.0} for r in rows]


def set_default_ingredients(db: Session, rows: list[dict]) -> None:
    """Replace the whole default-ingredient set (used by the 'set as default' flow)."""
    db.query(DefaultIngredient).delete()
    for idx, row in enumerate(rows):
        db.add(
            DefaultIngredient(
                name=row["name"],
                category=row.get("category", "Raw Material"),
                rate=row.get("rate", 0.0),
                unit=row.get("unit", ""),
                sort_order=idx,
                is_oil_vaprayel=row.get("is_oil_vaprayel", False),
            )
        )
    db.commit()


def set_default_products(db: Session, rows: list[dict]) -> None:
    db.query(RojmelDefaultProduct).delete()
    for idx, row in enumerate(rows):
        db.add(RojmelDefaultProduct(name=row["name"], rate=row.get("rate", 0.0), sort_order=idx))
    db.commit()
