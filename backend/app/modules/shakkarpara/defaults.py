"""Default ingredient rows seeded on a new batch.

These are the *initial* seed values. At runtime they live in the editable
`shakkarpara_default_ingredients` table (see models.DefaultIngredient) so the
"set as default" edit flow can change them — this list only seeds an empty DB.

Categories (5), rendered as separate tables each with a subtotal:
  Raw Material · Cooking/Frying · Fuel · Packaging · Worker
"""

# Category display order — used for grouping + subtotals everywhere.
CATEGORY_ORDER = ["Raw Material", "Cooking/Frying", "Fuel", "Packaging", "Worker"]

# Rates are the latest real rates from the source Excel (batch 2026-06-30) so a new
# batch starts pre-filled — the client only types usage, not known rates. Editable
# per batch, and changeable as the default via the edit-password "set as default" flow.
DEFAULT_INGREDIENTS: list[dict] = [
    {"name": "Menda", "category": "Raw Material", "rate": 890, "unit": "Katta", "is_oil_vaprayel": False},
    {"name": "Elaichi", "category": "Raw Material", "rate": 3000, "unit": "Gram", "is_oil_vaprayel": False},
    {"name": "Sugar", "category": "Raw Material", "rate": 43, "unit": "Kg", "is_oil_vaprayel": False},
    {"name": "Ghee", "category": "Raw Material", "rate": 160, "unit": "Kg", "is_oil_vaprayel": False},
    {"name": "Masala", "category": "Raw Material", "rate": 350, "unit": "Potli", "is_oil_vaprayel": False},
    {"name": "Oil", "category": "Cooking/Frying", "rate": 2350, "unit": "Lot Bandhta", "is_oil_vaprayel": False},
    {"name": "Oil Vaprayel", "category": "Cooking/Frying", "rate": 2350, "unit": "Dabba", "is_oil_vaprayel": True},
    {"name": "Pelet", "category": "Fuel", "rate": 15.25, "unit": "Kg", "is_oil_vaprayel": False},
    {"name": "Box & Plastic", "category": "Packaging", "rate": 20, "unit": "Pic", "is_oil_vaprayel": False},
    {"name": "Worker", "category": "Worker", "rate": 550, "unit": "Per Day", "is_oil_vaprayel": False},
]
