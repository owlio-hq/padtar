from datetime import date as date_type, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Batch(Base):
    __tablename__ = "shakkarpara_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    production_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    production_unit: Mapped[str] = mapped_column(String, nullable=False, default="kg")
    extra_per_unit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    ingredients: Mapped[list["BatchIngredient"]] = relationship(
        back_populates="batch", cascade="all, delete-orphan", order_by="BatchIngredient.sort_order"
    )
    oil_sit: Mapped["OilSit | None"] = relationship(back_populates="batch", cascade="all, delete-orphan", uselist=False)
    history: Mapped[list["BatchHistory"]] = relationship(back_populates="batch", cascade="all, delete-orphan")


class BatchIngredient(Base):
    __tablename__ = "shakkarpara_batch_ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("shakkarpara_batches.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False, default="Raw Material")
    rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    usage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    unit: Mapped[str] = mapped_column(String, nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_oil_vaprayel: Mapped[bool] = mapped_column(default=False)

    batch: Mapped["Batch"] = relationship(back_populates="ingredients")


class DefaultIngredient(Base):
    """Editable default ingredient rows used to seed a new batch. Moved out of the
    hardcoded list so the 'set as default' edit flow can change them at runtime."""

    __tablename__ = "shakkarpara_default_ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False, default="Raw Material")
    rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    unit: Mapped[str] = mapped_column(String, nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_oil_vaprayel: Mapped[bool] = mapped_column(default=False)


class OilSit(Base):
    __tablename__ = "shakkarpara_oil_sit"

    batch_id: Mapped[int] = mapped_column(ForeignKey("shakkarpara_batches.id", ondelete="CASCADE"), primary_key=True)
    nava_dabba: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    juna_dabba: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    toppa: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    parat_malela: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    batch: Mapped["Batch"] = relationship(back_populates="oil_sit")


class BatchHistory(Base):
    __tablename__ = "shakkarpara_batch_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("shakkarpara_batches.id", ondelete="CASCADE"))
    snapshot_json: Mapped[str] = mapped_column(Text, nullable=False)
    snapshot_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    batch: Mapped["Batch"] = relationship(back_populates="history")
