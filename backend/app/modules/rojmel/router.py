from datetime import date as date_type
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import defaults_store, history as history_core
from app.core.backup import backup_now
from app.core.logging import logger
from app.db import get_db
from app.modules.rojmel import engine, export as export_module
from app.modules.rojmel.defaults import DEFAULT_PRODUCTS
from app.modules.rojmel.models import (
    RojmelDay,
    RojmelDayHistory,
    RojmelExpenseLine,
    RojmelIncomeLine,
    RojmelSalesLine,
    RojmelStock,
)
from app.modules.rojmel.schemas import DayIn, DayOut, DefaultProductIn, HistorySnapshotOut, StockRowIn, StockRowOut

router = APIRouter(prefix="/api/rojmel", tags=["rojmel"])


def _to_engine_sales(day: RojmelDay) -> list[engine.SalesLine]:
    return [engine.SalesLine(product=s.product, rate=s.rate, qty=s.qty) for s in day.sales_lines]


def _to_engine_money(lines) -> list[engine.MoneyLine]:
    return [engine.MoneyLine(description=m.description, amount=m.amount, note=m.note) for m in lines]


def _serialize(day: RojmelDay) -> DayOut:
    result = engine.compute_day(_to_engine_sales(day), _to_engine_money(day.income_lines), _to_engine_money(day.expense_lines))
    totals_by_id = {line.id: computed for line, computed in zip(day.sales_lines, result.sales_lines)}

    sales_out = [
        {"id": s.id, "product": s.product, "rate": s.rate, "qty": s.qty, "total": totals_by_id[s.id].total}
        for s in day.sales_lines
    ]
    income_out = [
        {"id": m.id, "description": m.description, "amount": m.amount, "note": m.note} for m in day.income_lines
    ]
    expense_out = [
        {"id": m.id, "description": m.description, "amount": m.amount, "note": m.note} for m in day.expense_lines
    ]

    return DayOut(
        id=day.id,
        date=day.date,
        notes=day.notes,
        created_at=day.created_at,
        updated_at=day.updated_at,
        sales_lines=sales_out,
        income_lines=income_out,
        expense_lines=expense_out,
        factory_sales=result.factory_sales,
        total_income=result.total_income,
        total_expense=result.total_expense,
        cash_on_hand=result.cash_on_hand,
    )


def _snapshot_dict(day: RojmelDay) -> dict:
    return {
        "date": day.date.isoformat(),
        "notes": day.notes,
        "sales_lines": [{"product": s.product, "rate": s.rate, "qty": s.qty} for s in day.sales_lines],
        "income_lines": [{"description": m.description, "amount": m.amount, "note": m.note} for m in day.income_lines],
        "expense_lines": [{"description": m.description, "amount": m.amount, "note": m.note} for m in day.expense_lines],
    }


def _apply_sales(day: RojmelDay, sales_in, db: Session) -> None:
    day.sales_lines.clear()
    if sales_in is not None:
        rows = sales_in
    else:
        rows = defaults_store.get_default_products(db)  # dicts: {name, rate, qty}
        rows = [{"product": p["name"], "rate": p["rate"], "qty": 0.0} for p in rows]
    for idx, row in enumerate(rows):
        data = row if isinstance(row, dict) else row.model_dump()
        day.sales_lines.append(
            RojmelSalesLine(product=data["product"], rate=data.get("rate", 0.0), qty=data.get("qty", 0.0), sort_order=idx)
        )


def _apply_money(day: RojmelDay, attr: str, model, rows_in) -> None:
    getattr(day, attr).clear()
    rows = rows_in or []
    for idx, row in enumerate(rows):
        data = row if isinstance(row, dict) else row.model_dump()
        getattr(day, attr).append(
            model(description=data.get("description", ""), amount=data.get("amount", 0.0), note=data.get("note", ""), sort_order=idx)
        )


def _filtered_days(db: Session, year: int | None, month: int | None) -> list[RojmelDay]:
    days = db.query(RojmelDay).order_by(RojmelDay.date.desc()).all()
    if year is not None:
        days = [d for d in days if d.date.year == year]
    if month is not None:
        days = [d for d in days if d.date.month == month]
    return days


@router.get("/default-products")
def get_default_products(db: Session = Depends(get_db)):
    return defaults_store.get_default_products(db)


@router.put("/default-products")
def put_default_products(payload: list[DefaultProductIn], db: Session = Depends(get_db)):
    """Replace the default product set (used by the 'set as default' edit flow)."""
    defaults_store.set_default_products(db, [p.model_dump() for p in payload])
    return defaults_store.get_default_products(db)


@router.get("/days", response_model=list[DayOut])
def list_days(year: int | None = None, month: int | None = None, db: Session = Depends(get_db)):
    return [_serialize(d) for d in _filtered_days(db, year, month)]


@router.get("/days/export/excel")
def export_days_excel(year: int | None = None, month: int | None = None, db: Session = Depends(get_db)):
    days = [_serialize(d) for d in _filtered_days(db, year, month)]
    content = export_module.build_days_excel(days)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="rojmel.xlsx"'},
    )


@router.get("/days/export/pdf")
def export_days_pdf(year: int | None = None, month: int | None = None, db: Session = Depends(get_db)):
    days = [_serialize(d) for d in _filtered_days(db, year, month)]
    content = export_module.build_days_pdf(days)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="rojmel.pdf"'},
    )


@router.get("/days/{day_id}", response_model=DayOut)
def get_day(day_id: int, db: Session = Depends(get_db)):
    day = db.get(RojmelDay, day_id)
    if day is None:
        raise HTTPException(status_code=404, detail="Day not found")
    return _serialize(day)


@router.get("/days/{day_id}/export/excel")
def export_day_excel(day_id: int, db: Session = Depends(get_db)):
    day = db.get(RojmelDay, day_id)
    if day is None:
        raise HTTPException(status_code=404, detail="Day not found")
    content = export_module.build_days_excel([_serialize(day)])
    filename = f"rojmel_{day.date.isoformat()}_{day.id}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/days/{day_id}/export/pdf")
def export_day_pdf(day_id: int, db: Session = Depends(get_db)):
    day = db.get(RojmelDay, day_id)
    if day is None:
        raise HTTPException(status_code=404, detail="Day not found")
    content = export_module.build_days_pdf([_serialize(day)])
    filename = f"rojmel_{day.date.isoformat()}_{day.id}.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/days", response_model=DayOut)
def create_day(payload: DayIn, db: Session = Depends(get_db)):
    existing = db.query(RojmelDay).filter(RojmelDay.date == payload.date).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="A Rojmel entry already exists for this date")

    day = RojmelDay(date=payload.date, notes=payload.notes)
    _apply_sales(day, payload.sales_lines, db)
    _apply_money(day, "income_lines", RojmelIncomeLine, payload.income_lines)
    _apply_money(day, "expense_lines", RojmelExpenseLine, payload.expense_lines)

    db.add(day)
    db.commit()
    db.refresh(day)
    backup_now()
    logger.info("Created rojmel day id=%s date=%s", day.id, day.date)
    return _serialize(day)


@router.put("/days/{day_id}", response_model=DayOut)
def update_day(day_id: int, payload: DayIn, db: Session = Depends(get_db)):
    day = db.get(RojmelDay, day_id)
    if day is None:
        raise HTTPException(status_code=404, detail="Day not found")

    history_core.snapshot(db, RojmelDayHistory, "day_id", day.id, _snapshot_dict(day))

    day.date = payload.date
    day.notes = payload.notes
    _apply_sales(day, payload.sales_lines, db)
    _apply_money(day, "income_lines", RojmelIncomeLine, payload.income_lines)
    _apply_money(day, "expense_lines", RojmelExpenseLine, payload.expense_lines)

    db.commit()
    db.refresh(day)
    backup_now()
    logger.info("Updated rojmel day id=%s", day.id)
    return _serialize(day)


@router.delete("/days/{day_id}")
def delete_day(day_id: int, db: Session = Depends(get_db)):
    day = db.get(RojmelDay, day_id)
    if day is None:
        raise HTTPException(status_code=404, detail="Day not found")
    db.delete(day)
    db.commit()
    backup_now()
    logger.info("Deleted rojmel day id=%s", day_id)
    return {"ok": True}


@router.get("/days/{day_id}/history", response_model=list[HistorySnapshotOut])
def get_history(day_id: int, db: Session = Depends(get_db)):
    day = db.get(RojmelDay, day_id)
    if day is None:
        raise HTTPException(status_code=404, detail="Day not found")
    return history_core.list_snapshots(db, RojmelDayHistory, "day_id", day_id)


@router.post("/days/{day_id}/undo", response_model=DayOut)
def undo_day(day_id: int, db: Session = Depends(get_db)):
    day = db.get(RojmelDay, day_id)
    if day is None:
        raise HTTPException(status_code=404, detail="Day not found")

    data = history_core.restore_latest(db, RojmelDayHistory, "day_id", day_id)
    if data is None:
        raise HTTPException(status_code=400, detail="No history to undo")

    day.date = date_type.fromisoformat(data["date"])
    day.notes = data["notes"]
    _apply_sales(day, data["sales_lines"], db)
    _apply_money(day, "income_lines", RojmelIncomeLine, data["income_lines"])
    _apply_money(day, "expense_lines", RojmelExpenseLine, data["expense_lines"])

    db.commit()
    db.refresh(day)
    backup_now()
    logger.info("Undo applied to rojmel day id=%s", day.id)
    return _serialize(day)


def _closing_pic(db: Session, year: int, month: int, product: str) -> float:
    start = date_type(year, month, 1)
    end = date_type(year, month, monthrange(year, month)[1])
    total = (
        db.query(func.sum(RojmelSalesLine.qty))
        .join(RojmelDay, RojmelSalesLine.day_id == RojmelDay.id)
        .filter(RojmelDay.date >= start, RojmelDay.date <= end, RojmelSalesLine.product == product)
        .scalar()
    )
    return float(total) if total is not None else 0.0


def _serialize_stock(db: Session, row: RojmelStock) -> StockRowOut:
    closing = _closing_pic(db, row.year, row.month, row.product)
    return StockRowOut(
        id=row.id,
        year=row.year,
        month=row.month,
        product=row.product,
        rate=row.rate,
        opening_pic=row.opening_pic,
        closing_pic=closing,
        net_pic=engine.net_pic(row.opening_pic, closing),
    )


def _get_or_seed_stock(db: Session, year: int, month: int) -> list[RojmelStock]:
    rows = db.query(RojmelStock).filter(RojmelStock.year == year, RojmelStock.month == month).all()
    existing_products = {r.product for r in rows}
    for product in DEFAULT_PRODUCTS:
        if product["name"] not in existing_products:
            row = RojmelStock(year=year, month=month, product=product["name"], rate=product["rate"], opening_pic=0.0)
            db.add(row)
            rows.append(row)
    db.commit()
    rows.sort(key=lambda r: [p["name"] for p in DEFAULT_PRODUCTS].index(r.product) if r.product in [p["name"] for p in DEFAULT_PRODUCTS] else 999)
    return rows


@router.get("/stock", response_model=list[StockRowOut])
def get_stock(year: int, month: int, db: Session = Depends(get_db)):
    rows = _get_or_seed_stock(db, year, month)
    return [_serialize_stock(db, r) for r in rows]


@router.get("/stock/export/excel")
def export_stock_excel(year: int, month: int, db: Session = Depends(get_db)):
    rows = [_serialize_stock(db, r) for r in _get_or_seed_stock(db, year, month)]
    content = export_module.build_stock_excel(rows, year, month)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="rojmel-stock-{year}-{month:02d}.xlsx"'},
    )


@router.get("/stock/export/pdf")
def export_stock_pdf(year: int, month: int, db: Session = Depends(get_db)):
    rows = [_serialize_stock(db, r) for r in _get_or_seed_stock(db, year, month)]
    content = export_module.build_stock_pdf(rows, year, month)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="rojmel-stock-{year}-{month:02d}.pdf"'},
    )


@router.put("/stock/{row_id}", response_model=StockRowOut)
def update_stock(row_id: int, payload: StockRowIn, db: Session = Depends(get_db)):
    row = db.get(RojmelStock, row_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Stock row not found")
    if payload.rate is not None:
        row.rate = payload.rate
    if payload.opening_pic is not None:
        row.opening_pic = payload.opening_pic
    db.commit()
    db.refresh(row)
    backup_now()
    return _serialize_stock(db, row)
