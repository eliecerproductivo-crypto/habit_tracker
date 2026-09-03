import os

from dotenv import load_dotenv
load_dotenv()  # carga .env en local; en Vercel las vars ya están en el entorno

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import auth, habits, logs, stats, friends, categories, journal, profile, timer, wildcards

app = FastAPI(title="Rutina API", version="1.0.0")

# Comma-separated list of allowed origins, e.g. "https://mi-app.vercel.app,http://localhost:5173"
raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
allow_origins = [o.strip() for o in raw_origins.split(",")] if raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


# Vercel serverless: startup may not fire on every cold start.
# Run init_db lazily on the first real request as a safety net.
_db_initialized = False


@app.middleware("http")
async def ensure_db(request, call_next):
    global _db_initialized
    if not _db_initialized:
        init_db()
        _db_initialized = True
    return await call_next(request)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(habits.router)
app.include_router(logs.router)
app.include_router(stats.router)
app.include_router(friends.router)
app.include_router(categories.router)
app.include_router(journal.router)
app.include_router(profile.router)
app.include_router(timer.router)
app.include_router(wildcards.router)

