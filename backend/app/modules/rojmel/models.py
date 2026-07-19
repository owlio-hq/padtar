from datetime import date as date_type, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class RojmelDay(Base):
    __tablename__ = "rojmel_days"
    __table_args__ = (UniqueConstraint("date", name="uq_rojmel_day_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    sales_lines: Mapped[list["RojmelSalesLine"]] = relationship(
        back_populates="day", cascade="all, delete-orphan", order_by="RojmelSalesLine.sort_order"
    )
    income_lines: Mapped[list["RojmelIncomeLine"]] = relationship(
        back_populates="day", cascade="all, delete-orphan", order_by="RojmelIncomeLine.sort_order"
    )
    expense_lines: Mapped[list["RojmelExpenseLine"]] = relationship(
        back_populates="day", cascade="all, delete-orphan", order_by="RojmelExpenseLine.sort_order"
    )
    carry_forward_lines: Mapped[list["RojmelCarryForwardLine"]] = relationship(
        back_populates="day", cascade="all, delete-orphan", order_by="RojmelCarryForwardLine.sort_order"
    )
    history: Mapped[list["RojmelDayHistory"]] = relationship(back_populates="day", cascade="all, delete-orphan")


class RojmelSalesLine(Base):
    __tablename__ = "rojmel_sales_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day_id: Mapped[int] = mapped_column(ForeignKey("rojmel_days.id", ondelete="CASCADE"))
    product: Mapped[str] = mapped_column(String, nullable=False)
    rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    qty: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # OPP.PIC / CLO.PIC — morning + evening counts, both typed by the owner.
    # NET.PIC (= opening − closing) is derived at serialize time, never stored.
    opening_pic: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    closing_pic: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    day: Mapped["RojmelDay"] = relationship(back_populates="sales_lines")


class RojmelIncomeLine(Base):
    __tablename__ = "rojmel_income_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day_id: Mapped[int] = mapped_column(ForeignKey("rojmel_days.id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(String, nullable=False, default="")
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    note: Mapped[str] = mapped_column(String, nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    day: Mapped["RojmelDay"] = relationship(back_populates="income_lines")


class RojmelExpenseLine(Base):
    __tablename__ = "rojmel_expense_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day_id: Mapped[int] = mapped_column(ForeignKey("rojmel_days.id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(String, nullable=False, default="")
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    note: Mapped[str] = mapped_column(String, nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    day: Mapped["RojmelDay"] = relationship(back_populates="expense_lines")


class RojmelCarryForwardLine(Base):
    """Named carry-forward amounts shown below the notes (e.g. "Chirag bhai", "Chetna ben").
    Informational only — like the block below the totals in the Excel, NOT part of any total."""

    __tablename__ = "rojmel_carry_forward_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day_id: Mapped[int] = mapped_column(ForeignKey("rojmel_days.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, nullable=False, default="")
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    day: Mapped["RojmelDay"] = relationship(back_populates="carry_forward_lines")


class RojmelDayHistory(Base):
    __tablename__ = "rojmel_day_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day_id: Mapped[int] = mapped_column(ForeignKey("rojmel_days.id", ondelete="CASCADE"))
    snapshot_json: Mapped[str] = mapped_column(Text, nullable=False)
    snapshot_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    day: Mapped["RojmelDay"] = relationship(back_populates="history")


class RojmelDefaultProduct(Base):
    """Editable default product rows used to seed a new day's sales grid.
    Moved out of the hardcoded list so the 'set as default' edit flow can change them."""

    __tablename__ = "rojmel_default_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class RojmelStock(Base):
    """Monthly opening/closing stock reconciliation, per product.
    Filled once a month from a physical count — not part of the daily entries."""

    __tablename__ = "rojmel_stock"
    __table_args__ = (UniqueConstraint("year", "month", "product", name="uq_rojmel_stock_period_product"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    product: Mapped[str] = mapped_column(String, nullable=False)
    rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    opening_pic: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
