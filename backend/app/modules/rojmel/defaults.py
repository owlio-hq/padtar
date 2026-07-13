"""Default product list seeded on a new day entry, with default rates
(CLAUDE.md / docs/FILE2-ANALYSIS.md — fixed defaults, editable per entry)."""

# Naming convention: product name first, size/quantity after (e.g. "Salted Wafer 200g").
DEFAULT_PRODUCTS: list[dict] = [
    {"name": "Salted Wafer 200g", "rate": 40},
    {"name": "Masala 200g", "rate": 50},
    {"name": "Salted Wafer 500g", "rate": 100},
    {"name": "Mitho Tikho", "rate": 40},
    {"name": "Yellow", "rate": 60},
    {"name": "Banana", "rate": 50},
    {"name": "Red Wafer", "rate": 50},
    {"name": "Salted Wafer 50g", "rate": 10},
    {"name": "Para 200g", "rate": 30},
    {"name": "Para 500g", "rate": 80},
]
