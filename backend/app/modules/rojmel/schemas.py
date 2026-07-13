from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class SalesLineIn(BaseModel):
    product: str
    rate: float = 0.0
    qty: float = 0.0


class SalesLineOut(SalesLineIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    total: float


class DefaultProductIn(BaseModel):
    name: str
    rate: float = 0.0


class MoneyLineIn(BaseModel):
    description: str = ""
    amount: float = 0.0
    note: str = ""


class MoneyLineOut(MoneyLineIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class DayIn(BaseModel):
    date: date
    notes: str | None = None
    sales_lines: list[SalesLineIn] | None = None  # None -> seed default products
    income_lines: list[MoneyLineIn] | None = None
    expense_lines: list[MoneyLineIn] | None = None


class DayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    date: date
    notes: str | None
    created_at: datetime
    updated_at: datetime
    sales_lines: list[SalesLineOut]
    income_lines: list[MoneyLineOut]
    expense_lines: list[MoneyLineOut]
    factory_sales: float
    total_income: float
    total_expense: float
    cash_on_hand: float


class HistorySnapshotOut(BaseModel):
    id: int
    snapshot_at: str
    data: dict


class StockRowIn(BaseModel):
    rate: float | None = None
    opening_pic: float | None = None


class StockRowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    year: int
    month: int
    product: str
    rate: float
    opening_pic: float
    closing_pic: float
    net_pic: float
