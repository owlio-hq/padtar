from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class OilSitIn(BaseModel):
    nava_dabba: float = 0.0
    juna_dabba: float = 0.0
    toppa: float = 0.0
    parat_malela: float = 0.0


class OilSitOut(OilSitIn):
    model_config = ConfigDict(from_attributes=True)
    net_vaprash: float


class IngredientIn(BaseModel):
    name: str
    category: str = "Raw Material"
    rate: float = 0.0
    usage: float = 0.0
    unit: str = ""
    is_oil_vaprayel: bool = False


class IngredientOut(IngredientIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    total: float


class BatchIn(BaseModel):
    date: date
    production_qty: float = 0.0
    production_unit: str = "kg"
    extra_per_unit: float = 0.0
    notes: str | None = None
    ingredients: list[IngredientIn] | None = None  # None -> seed defaults
    oil_sit: OilSitIn | None = None


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    date: date
    production_qty: float
    production_unit: str
    extra_per_unit: float
    notes: str | None
    created_at: datetime
    updated_at: datetime
    ingredients: list[IngredientOut]
    oil_sit: OilSitOut | None
    total: float
    padtar: float | None


class HistorySnapshotOut(BaseModel):
    id: int
    snapshot_at: str
    data: dict
