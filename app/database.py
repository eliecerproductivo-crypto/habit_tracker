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

engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    # Creates tables if they don't exist yet. Fine for this project's scope;
    # swap for Alembic migrations if the schema needs to evolve carefully later.
    from app import models  # noqa: F401  (ensures models are registered)

    Base.metadata.create_all(bind=engine)
