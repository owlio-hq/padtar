from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core import defaults_store, history as history_core
from app.core.backup import backup_now
from app.core.logging import logger
from app.db import get_db
from app.modules.shakkarpara import engine, export as export_module
from app.modules.shakkarpara.models import Batch, BatchHistory, BatchIngredient, OilSit
from app.modules.shakkarpara.schemas import BatchIn, BatchOut, HistorySnapshotOut, IngredientIn, OilSitIn

router = APIRouter(prefix="/api/shakkarpara", tags=["shakkarpara"])


def _filtered_batches(db: Session, year: int | None, month: int | None) -> list[Batch]:
    batches = db.query(Batch).order_by(Batch.date.desc()).all()
    if year is not None:
        batches = [b for b in batches if b.date.year == year]
    if month is not None:
        batches = [b for b in batches if b.date.month == month]
    return batches


def _to_engine_lines(batch: Batch) -> list[engine.IngredientLine]:
    return [
        engine.IngredientLine(
            name=i.name, rate=i.rate, usage=i.usage, unit=i.unit,
            is_oil_vaprayel=i.is_oil_vaprayel, category=i.category,
        )
        for i in batch.ingredients
    ]


def _to_engine_oil_sit(batch: Batch) -> engine.OilSit | None:
    if batch.oil_sit is None:
        return None
    return engine.OilSit(
        nava_dabba=batch.oil_sit.nava_dabba,
        juna_dabba=batch.oil_sit.juna_dabba,
        toppa=batch.oil_sit.toppa,
        parat_malela=batch.oil_sit.parat_malela,
    )


def _serialize(batch: Batch) -> BatchOut:
    result = engine.compute_batch(
        _to_engine_lines(batch), _to_engine_oil_sit(batch), batch.production_qty, batch.extra_per_unit
    )
    computed_by_id = {ing.id: line for ing, line in zip(batch.ingredients, result.lines)}

    ingredients_out = [
        {
            "id": ing.id,
            "name": ing.name,
            "category": ing.category,
            "rate": ing.rate,
            "usage": computed_by_id[ing.id].usage,
            "unit": ing.unit,
            "is_oil_vaprayel": ing.is_oil_vaprayel,
            "total": computed_by_id[ing.id].total,
        }
        for ing in batch.ingredients
    ]

    oil_sit_out = None
    if batch.oil_sit is not None:
        oil_sit_out = {
            "nava_dabba": batch.oil_sit.nava_dabba,
            "juna_dabba": batch.oil_sit.juna_dabba,
            "toppa": batch.oil_sit.toppa,
            "parat_malela": batch.oil_sit.parat_malela,
            "net_vaprash": engine.oil_sit_net(_to_engine_oil_sit(batch)),
        }

    return BatchOut(
        id=batch.id,
        date=batch.date,
        production_qty=batch.production_qty,
        production_unit=batch.production_unit,
        extra_per_unit=batch.extra_per_unit,
        notes=batch.notes,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        ingredients=ingredients_out,
        oil_sit=oil_sit_out,
        total=result.total,
        padtar=result.padtar,
    )


def _snapshot_dict(batch: Batch) -> dict:
    return {
        "date": batch.date.isoformat(),
        "production_qty": batch.production_qty,
        "production_unit": batch.production_unit,
        "extra_per_unit": batch.extra_per_unit,
        "notes": batch.notes,
        "ingredients": [
            {"name": i.name, "category": i.category, "rate": i.rate, "usage": i.usage,
             "unit": i.unit, "is_oil_vaprayel": i.is_oil_vaprayel}
            for i in batch.ingredients
        ],
        "oil_sit": (
            {
                "nava_dabba": batch.oil_sit.nava_dabba,
                "juna_dabba": batch.oil_sit.juna_dabba,
                "toppa": batch.oil_sit.toppa,
                "parat_malela": batch.oil_sit.parat_malela,
            }
            if batch.oil_sit
            else None
        ),
    }


def _apply_ingredients(batch: Batch, ingredients_in, db: Session) -> None:
    batch.ingredients.clear()
    rows = ingredients_in if ingredients_in is not None else defaults_store.get_default_ingredients(db)
    for idx, row in enumerate(rows):
        data = row if isinstance(row, dict) else row.model_dump()
        batch.ingredients.append(
            BatchIngredient(
                name=data["name"],
                category=data.get("category", "Raw Material"),
                rate=data.get("rate", 0.0),
                usage=data.get("usage", 0.0),
                unit=data.get("unit", ""),
                sort_order=idx,
                is_oil_vaprayel=data.get("is_oil_vaprayel", False),
            )
        )


def _apply_oil_sit(batch: Batch, oil_sit_in) -> None:
    if oil_sit_in is None:
        batch.oil_sit = None
        return
    data = oil_sit_in if isinstance(oil_sit_in, dict) else oil_sit_in.model_dump()
    if batch.oil_sit is None:
        batch.oil_sit = OilSit(**data)
    else:
        for key, value in data.items():
            setattr(batch.oil_sit, key, value)


@router.get("/default-ingredients")
def get_default_ingredients(db: Session = Depends(get_db)):
    return defaults_store.get_default_ingredients(db)


@router.put("/default-ingredients")
def put_default_ingredients(payload: list[IngredientIn], db: Session = Depends(get_db)):
    """Replace the default ingredient set (used by the 'set as default' edit flow).
    Edit-password gating is enforced client-side before this is called."""
    defaults_store.set_default_ingredients(db, [p.model_dump() for p in payload])
    return defaults_store.get_default_ingredients(db)


@router.get("/batches", response_model=list[BatchOut])
def list_batches(year: int | None = None, month: int | None = None, db: Session = Depends(get_db)):
    return [_serialize(b) for b in _filtered_batches(db, year, month)]


@router.get("/batches/export/excel")
def export_excel(year: int | None = None, month: int | None = None, db: Session = Depends(get_db)):
    batches = [_serialize(b) for b in _filtered_batches(db, year, month)]
    content = export_module.build_excel(batches)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="shakkarpara.xlsx"'},
    )


@router.get("/batches/export/pdf")
def export_pdf(year: int | None = None, month: int | None = None, db: Session = Depends(get_db)):
    batches = [_serialize(b) for b in _filtered_batches(db, year, month)]
    content = export_module.build_pdf(batches)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="shakkarpara.pdf"'},
    )


@router.get("/batches/{batch_id}", response_model=BatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return _serialize(batch)


@router.get("/batches/{batch_id}/export/excel")
def export_batch_excel(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    content = export_module.build_excel([_serialize(batch)])
    filename = f"shakkarpara_{batch.date.isoformat()}_{batch.id}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/batches/{batch_id}/export/pdf")
def export_batch_pdf(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    content = export_module.build_pdf([_serialize(batch)])
    filename = f"shakkarpara_{batch.date.isoformat()}_{batch.id}.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/batches", response_model=BatchOut)
def create_batch(payload: BatchIn, db: Session = Depends(get_db)):
    batch = Batch(
        date=payload.date,
        production_qty=payload.production_qty,
        production_unit=payload.production_unit,
        extra_per_unit=payload.extra_per_unit,
        notes=payload.notes,
    )
    _apply_ingredients(batch, payload.ingredients, db)

    seeding_defaults = payload.ingredients is None
    oil_sit_payload = payload.oil_sit if payload.oil_sit is not None else (OilSitIn() if seeding_defaults else None)
    _apply_oil_sit(batch, oil_sit_payload)

    db.add(batch)
    db.commit()
    db.refresh(batch)
    backup_now()
    logger.info("Created shakkarpara batch id=%s date=%s", batch.id, batch.date)
    return _serialize(batch)


@router.put("/batches/{batch_id}", response_model=BatchOut)
def update_batch(batch_id: int, payload: BatchIn, db: Session = Depends(get_db)):
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")

    history_core.snapshot(db, BatchHistory, "batch_id", batch.id, _snapshot_dict(batch))

    batch.date = payload.date
    batch.production_qty = payload.production_qty
    batch.production_unit = payload.production_unit
    batch.extra_per_unit = payload.extra_per_unit
    batch.notes = payload.notes
    _apply_ingredients(batch, payload.ingredients, db)
    _apply_oil_sit(batch, payload.oil_sit)

    db.commit()
    db.refresh(batch)
    backup_now()
    logger.info("Updated shakkarpara batch id=%s", batch.id)
    return _serialize(batch)


@router.delete("/batches/{batch_id}")
def delete_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    db.delete(batch)
    db.commit()
    backup_now()
    logger.info("Deleted shakkarpara batch id=%s", batch_id)
    return {"ok": True}


@router.get("/batches/{batch_id}/history", response_model=list[HistorySnapshotOut])
def get_history(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return history_core.list_snapshots(db, BatchHistory, "batch_id", batch_id)


@router.post("/batches/{batch_id}/undo", response_model=BatchOut)
def undo_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")

    data = history_core.restore_latest(db, BatchHistory, "batch_id", batch_id)
    if data is None:
        raise HTTPException(status_code=400, detail="No history to undo")

    batch.date = date_type.fromisoformat(data["date"])
    batch.production_qty = data["production_qty"]
    batch.production_unit = data["production_unit"]
    batch.extra_per_unit = data.get("extra_per_unit", 0.0)
    batch.notes = data["notes"]
    _apply_ingredients(batch, data["ingredients"], db)
    _apply_oil_sit(batch, data["oil_sit"])

    db.commit()
    db.refresh(batch)
    backup_now()
    logger.info("Undo applied to shakkarpara batch id=%s", batch.id)
    return _serialize(batch)
