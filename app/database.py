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
