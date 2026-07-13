from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DB_PATH


class Base(DeclarativeBase):
    pass


engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, _record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Tiny additive migrations: (table, column, SQL type + default) to add when missing.
# create_all() only creates missing tables, never alters existing ones — so when the
# app is updated on a PC that already has a db, we add new columns here idempotently.
_ADDITIVE_COLUMNS = [
    ("shakkarpara_batches", "extra_per_unit", "FLOAT NOT NULL DEFAULT 0.0"),
    ("shakkarpara_batch_ingredients", "category", "VARCHAR NOT NULL DEFAULT 'Raw Material'"),
]


def _apply_additive_migrations():
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, column, coldef in _ADDITIVE_COLUMNS:
            if table not in existing_tables:
                continue
            cols = {c["name"] for c in inspector.get_columns(table)}
            if column not in cols:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {coldef}"))


def init_db():
    from app.modules.rojmel import models as rojmel_models  # noqa: F401
    from app.modules.shakkarpara import models as shakkarpara_models  # noqa: F401
    from app.core import labels as labels_module
    from app.core import settings as settings_module  # noqa: F401 — registers the SettingRow table
    from app.core import defaults_store

    Base.metadata.create_all(bind=engine)
    _apply_additive_migrations()
    labels_module.seed_defaults()
    defaults_store.seed_defaults()

    from app.core import auth as auth_module
    db = SessionLocal()
    try:
        auth_module.ensure_seeded(db)
    finally:
        db.close()
