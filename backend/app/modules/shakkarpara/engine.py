"""Standalone formula engine for Shakkarpara batch costing.

Pure functions only — no DB, no I/O. Mirrors the original Excel formulas
exactly (see docs/FILE3-ANALYSIS.md):
    line total   = rate * usage                         (Excel: =SUM(C*D))
    oil net      = nava + juna + toppa - parat_malela    (Excel: =SUM(C+D+E-F))
    batch total  = sum of all line totals                (Excel: =SUM(F_first:F_last))
    padtar       = total / production + extra_per_unit    (Excel: =SUM(total/production)  or  +10)

`extra_per_unit` is a flat per-unit overhead the client began adding (~₹10/unit
from mid-2025). It only affects padtar, never the total — exactly matching the
Excel formula `=SUM(F/C)+10`. Defaults to 0, so older batches are unchanged.

All arithmetic uses native Python floats (IEEE-754 double), same as Excel,
so results match cell-for-cell — never use Decimal here.
"""

from dataclasses import dataclass


@dataclass
class IngredientLine:
    name: str
    rate: float
    usage: float
    unit: str
    is_oil_vaprayel: bool = False
    category: str = "Raw Material"


@dataclass
class OilSit:
    nava_dabba: float
    juna_dabba: float
    toppa: float
    parat_malela: float


@dataclass
class ComputedLine:
    name: str
    rate: float
    usage: float
    unit: str
    is_oil_vaprayel: bool
    total: float
    category: str = "Raw Material"


@dataclass
class BatchResult:
    lines: list[ComputedLine]
    total: float
    padtar: float | None  # None when production_qty is 0, mirrors Excel's #DIV/0!


def line_total(rate: float, usage: float) -> float:
    return rate * usage


def oil_sit_net(oil_sit: OilSit) -> float:
    return oil_sit.nava_dabba + oil_sit.juna_dabba + oil_sit.toppa - oil_sit.parat_malela


def compute_batch(
    ingredients: list[IngredientLine],
    oil_sit: OilSit | None,
    production_qty: float,
    extra_per_unit: float = 0.0,
) -> BatchResult:
    computed: list[ComputedLine] = []
    for ing in ingredients:
        usage = ing.usage
        if ing.is_oil_vaprayel and oil_sit is not None:
            usage = oil_sit_net(oil_sit)
        computed.append(
            ComputedLine(
                name=ing.name,
                rate=ing.rate,
                usage=usage,
                unit=ing.unit,
                is_oil_vaprayel=ing.is_oil_vaprayel,
                total=line_total(ing.rate, usage),
                category=ing.category,
            )
        )

    total = 0.0
    for line in computed:
        total += line.total  # sequential sum, matches Excel's SUM() left-to-right accumulation

    padtar = (total / production_qty + extra_per_unit) if production_qty else None

    return BatchResult(lines=computed, total=total, padtar=padtar)
