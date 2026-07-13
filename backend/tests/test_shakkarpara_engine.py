"""Cell-for-cell replica tests: the engine must reproduce every one of the
114 real historical batches extracted from source_excel/03_shakkarpara.xlsx
(see scripts/extract_shakkarpara_fixtures.py), matching Excel's own cached
formula results exactly (CLAUDE.md: no rounding, exact same results)."""

import json
from pathlib import Path

import pytest

from app.modules.shakkarpara import engine

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "shakkarpara_extracted.json"
BATCHES = json.loads(FIXTURES_PATH.read_text())

# Confirmed by inspecting raw (non-cached) formulas with openpyxl: in this one batch,
# out of 114, the oil-sit "net vaprash" cell (sheet 1.7.24, row 70, col F) is a hardcoded
# constant (11) rather than the live `=nava+juna+toppa-parat` formula every other batch
# uses — a stale manual override in the client's own source file, not an engine defect.
# The engine correctly implements the formula; this row's source data is simply wrong.
KNOWN_SOURCE_DATA_ANOMALIES = {
    ("1.7.24", "2024-07-24"): "oil-sit net_vaprash was manually overwritten with a stale constant in the source Excel",
}


def _param(batch: dict):
    key = (batch["sheet"], batch["date"])
    reason = KNOWN_SOURCE_DATA_ANOMALIES.get(key)
    marks = [pytest.mark.xfail(reason=reason, strict=True)] if reason else []
    return pytest.param(batch, marks=marks, id=f"{batch['sheet']}:{batch['date']}")


BATCH_PARAMS = [_param(b) for b in BATCHES]


def _to_engine_inputs(batch: dict):
    ingredients = [
        engine.IngredientLine(
            name=ing["name"],
            rate=ing["rate"],
            usage=ing["usage"],
            unit=ing["unit"],
            is_oil_vaprayel="oil vaprayel" in ing["name"].lower(),
        )
        for ing in batch["ingredients"]
    ]
    oil_sit = engine.OilSit(**batch["oil_sit"])
    return ingredients, oil_sit


def test_fixtures_loaded():
    assert len(BATCHES) == 114


@pytest.mark.parametrize("batch", BATCH_PARAMS)
def test_line_totals_match_excel(batch):
    ingredients, oil_sit = _to_engine_inputs(batch)
    result = engine.compute_batch(ingredients, oil_sit, batch["production_qty"])
    for line, expected in zip(result.lines, batch["ingredients"]):
        assert line.total == expected["expected_total"], f"{batch['sheet']} {batch['date']} {line.name}"


@pytest.mark.parametrize("batch", BATCH_PARAMS)
def test_oil_sit_net_matches_excel(batch):
    _, oil_sit = _to_engine_inputs(batch)
    if batch["expected_net_vaprash"] is None:
        pytest.skip("no oil-sit net recorded for this batch")
    assert engine.oil_sit_net(oil_sit) == batch["expected_net_vaprash"]


@pytest.mark.parametrize("batch", BATCH_PARAMS)
def test_batch_total_matches_excel(batch):
    ingredients, oil_sit = _to_engine_inputs(batch)
    result = engine.compute_batch(ingredients, oil_sit, batch["production_qty"])
    assert result.total == batch["expected_batch_total"]


@pytest.mark.parametrize("batch", BATCH_PARAMS)
def test_padtar_matches_excel(batch):
    ingredients, oil_sit = _to_engine_inputs(batch)
    result = engine.compute_batch(ingredients, oil_sit, batch["production_qty"])
    if batch["expected_padtar"] is None:
        pytest.skip("no padtar recorded for this batch")
    assert result.padtar == batch["expected_padtar"]


def _simple_ingredients():
    return [engine.IngredientLine(name="X", rate=10.0, usage=5.0, unit="")]  # total 50


def test_extra_per_unit_defaults_zero():
    # extra defaults to 0 -> plain total/production, unchanged behaviour
    result = engine.compute_batch(_simple_ingredients(), None, production_qty=10.0)
    assert result.total == 50.0
    assert result.padtar == 5.0


def test_extra_per_unit_added_to_padtar_only():
    # +10 overhead affects padtar, never the total (matches Excel =SUM(F/C)+10)
    result = engine.compute_batch(_simple_ingredients(), None, production_qty=10.0, extra_per_unit=10.0)
    assert result.total == 50.0
    assert result.padtar == 15.0  # 50/10 + 10


def test_extra_per_unit_none_when_no_production():
    # no production -> padtar is None even with an extra set (mirrors #DIV/0!)
    result = engine.compute_batch(_simple_ingredients(), None, production_qty=0.0, extra_per_unit=10.0)
    assert result.padtar is None
