from pydantic import BaseModel, ConfigDict
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, Session

from app.db import Base, SessionLocal


class LabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    key: str
    gujarati_label: str
    english_label: str


class LabelIn(BaseModel):
    gujarati_label: str | None = None
    english_label: str | None = None

# key -> (gujarati-in-latin-script label, english label)
DEFAULT_LABELS: dict[str, tuple[str, str]] = {
    "app.name": ("Padtar", "Padtar"),
    "app.tagline": ("Factory Ledger", "Factory Ledger"),
    "nav.dashboard": ("Dashboard", "Dashboard"),
    "nav.rojmel": ("Rojmel", "Daily Sales"),
    "nav.shakkarpara": ("Shakkarpara", "Batch Costing"),
    "nav.settings": ("Settings", "Settings"),
    "shakkarpara.title": ("Shakkarpara", "Batch Costing"),
    "shakkarpara.batch": ("Batch", "Batch"),
    "shakkarpara.date": ("Date", "Date"),
    "shakkarpara.production": ("Production", "Production"),
    "shakkarpara.padtar": ("Padtar", "Cost per unit"),
    "shakkarpara.total": ("Total", "Total"),
    "shakkarpara.rate": ("Rate", "Rate"),
    "shakkarpara.usage": ("Vaprash", "Usage"),
    "shakkarpara.unit": ("Unit", "Unit"),
    "shakkarpara.notes": ("Notes", "Notes"),
    "shakkarpara.oil_sit": ("Oil Sheet", "Oil Sheet"),
    "shakkarpara.nava_dabba": ("Nava Dabba", "New Tin"),
    "shakkarpara.juna_dabba": ("Juna Dabba", "Old Tin"),
    "shakkarpara.toppa": ("Toppa", "Toppa"),
    "shakkarpara.parat_malela": ("Parat Malela", "Returned"),
    "shakkarpara.net_vaprash": ("Net Vaprash", "Net Usage"),
    "ingredient.oil": ("Oil", "Oil"),
    "ingredient.menda": ("Menda", "Flour"),
    "ingredient.elaichi": ("Elaichi", "Cardamom"),
    "ingredient.sugar": ("Sugar", "Sugar"),
    "ingredient.ghee": ("Ghee", "Ghee"),
    "ingredient.pelet": ("Pelet", "Pellet"),
    "ingredient.box_plastic": ("Box & Plastic", "Box & Plastic"),
    "ingredient.masala": ("Masala", "Spice Mix"),
    "ingredient.oil_vaprayel": ("Oil Vaprayel", "Oil Used"),
    "ingredient.mansho": ("Worker", "Worker"),
    "rojmel.title": ("Rojmel", "Daily Sales"),
    "rojmel.date": ("Date", "Date"),
    "rojmel.product": ("Product", "Product"),
    "rojmel.rate": ("Rate", "Rate"),
    "rojmel.qty": ("Pic", "Pieces"),
    "rojmel.total": ("Total", "Total"),
    "rojmel.factory_sales": ("Factory Sales", "Factory Sales"),
    "rojmel.income": ("Income", "Income"),
    "rojmel.expense": ("Kharcho", "Expense"),
    "rojmel.cash_on_hand": ("Cash on Hand", "Cash on Hand"),
    "rojmel.notes": ("Notes", "Notes"),
    "rojmel.stock": ("Stock", "Stock"),
    "rojmel.opening_pic": ("OPP.PIC", "Opening Pieces"),
    "rojmel.closing_pic": ("CLO.PIC", "Closing Pieces"),
    "rojmel.net_pic": ("NET.PIC", "Net Pieces"),
    "unit.lot_bandhta": ("Lot Bandhta", "Batter"),
    "unit.katta": ("Katta", "Sack"),
    "unit.gram": ("Gram", "Gram"),
    "unit.kg_ma": ("Kg Ma", "Kg"),
    "unit.pic": ("Pic", "Pieces"),
    "unit.potli": ("Potli", "Pouch"),
    "unit.dabba": ("Dabba", "Tin"),
    "unit.per_day": ("Per Day", "Per Day"),
}


class Label(Base):
    __tablename__ = "labels"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    gujarati_label: Mapped[str] = mapped_column(String, nullable=False)
    english_label: Mapped[str] = mapped_column(String, nullable=False)


def seed_defaults() -> None:
    db: Session = SessionLocal()
    try:
        existing_keys = {row.key for row in db.query(Label.key).all()}
        for key, (gujarati, english) in DEFAULT_LABELS.items():
            if key not in existing_keys:
                db.add(Label(key=key, gujarati_label=gujarati, english_label=english))
        db.commit()
    finally:
        db.close()


def get_all(db: Session) -> list[Label]:
    return db.query(Label).order_by(Label.key).all()


def set_label(db: Session, key: str, gujarati_label: str | None, english_label: str | None) -> Label:
    label = db.query(Label).filter(Label.key == key).first()
    if label is None:
        label = Label(key=key, gujarati_label=gujarati_label or key, english_label=english_label or key)
        db.add(label)
    else:
        if gujarati_label is not None:
            label.gujarati_label = gujarati_label
        if english_label is not None:
            label.english_label = english_label
    db.commit()
    db.refresh(label)
    return label
