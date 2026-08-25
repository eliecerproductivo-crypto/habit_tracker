import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

# DATABASE_URL examples:
#   Local dev (no Postgres set up yet):  sqlite:///./habit_tracker.db
#   Supabase (recommended for serverless — use the "Connection pooling" URI,
#   port 6543, transaction mode) e.g.:
#   postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./habit_tracker.db")

# SQLAlchemy necesita el prefijo "postgresql+psycopg" para usar psycopg v3.
# Si la URL viene como "postgresql://" (ej: desde Supabase), la convertimos.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)

# psycopg v3 no acepta "pgbouncer=true" como query param — lo quitamos.
if "pgbouncer" in DATABASE_URL:
    from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
    parsed = urlparse(DATABASE_URL)
    params = {k: v for k, v in parse_qs(parsed.query).items() if k != "pgbouncer"}
    DATABASE_URL = urlunparse(parsed._replace(query=urlencode(params, doseq=True)))

connect_args = {}
engine_kwargs = {"pool_pre_ping": True}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # Serverless functions are short-lived: don't keep a persistent pool around
    # between invocations. Supabase's pooler (pgbouncer) handles pooling for us.
    engine_kwargs["poolclass"] = NullPool
    # PgBouncer en transaction mode no soporta prepared statements de psycopg3
    connect_args = {"prepare_threshold": None}

engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate(connection):
    """Apply incremental schema changes that create_all cannot handle
    (renaming/replacing columns on existing tables)."""
    from sqlalchemy import inspect, text

    inspector = inspect(connection)
    tables = inspector.get_table_names()

    # ── habit_logs: completed+completed_at → status+logged_at ──────────────
    if "habit_logs" in tables:
        columns = {c["name"] for c in inspector.get_columns("habit_logs")}

        if "completed" in columns and "status" not in columns:
            connection.execute(text(
                "ALTER TABLE habit_logs ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'done'"
            ))
            connection.execute(text(
                "UPDATE habit_logs SET status = CASE WHEN completed THEN 'done' ELSE 'failed' END"
            ))

        if "completed_at" in columns and "logged_at" not in columns:
            connection.execute(text(
                "ALTER TABLE habit_logs RENAME COLUMN completed_at TO logged_at"
            ))

        if "completed" in columns and "status" in columns:
            dialect = connection.dialect.name
            if dialect == "postgresql":
                connection.execute(text(
                    "ALTER TABLE habit_logs DROP COLUMN IF EXISTS completed"
                ))

    # ── habits: start_time / end_time → nullable ───────────────────────────
    if "habits" in tables:
        dialect = connection.dialect.name
        if dialect == "postgresql":
            connection.execute(text(
                "ALTER TABLE habits ALTER COLUMN start_time DROP NOT NULL"
            ))
            connection.execute(text(
                "ALTER TABLE habits ALTER COLUMN end_time DROP NOT NULL"
            ))

    # ── habits: recurrence & start_date (nuevas columnas) ─────────────────
    if "habits" in tables:
        habit_cols = {c["name"] for c in inspector.get_columns("habits")}
        if "duration_minutes" not in habit_cols:
            connection.execute(text(
                "ALTER TABLE habits ADD COLUMN duration_minutes INTEGER DEFAULT NULL"
            ))
        if "start_date" not in habit_cols:
            connection.execute(text(
                "ALTER TABLE habits ADD COLUMN start_date DATE DEFAULT NULL"
            ))
        if "recurrence_type" not in habit_cols:
            connection.execute(text(
                "ALTER TABLE habits ADD COLUMN recurrence_type VARCHAR(10) NOT NULL DEFAULT 'weekly'"
            ))
        if "recurrence_interval" not in habit_cols:
            connection.execute(text(
                "ALTER TABLE habits ADD COLUMN recurrence_interval INTEGER DEFAULT NULL"
            ))
        if "recurrence_day_of_month" not in habit_cols:
            connection.execute(text(
                "ALTER TABLE habits ADD COLUMN recurrence_day_of_month INTEGER DEFAULT NULL"
            ))

    # ── categories: unique constraint (user_id, name) ─────────────────────────
    if "categories" in tables:
        dialect = connection.dialect.name
        if dialect == "postgresql":
            connection.execute(text(
                "DO $$ BEGIN "
                "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_category_user_name') "
                "THEN ALTER TABLE categories ADD CONSTRAINT uq_category_user_name UNIQUE (user_id, name); "
                "END IF; END $$;"
            ))

def init_db():
    # Creates tables if they don't exist yet, then applies pending migrations.
    from app import models  # noqa: F401  (ensures models are registered)

    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        _migrate(conn)
