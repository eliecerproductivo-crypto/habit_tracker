import sys
from pathlib import Path

# Ensure the project root (which contains the `app` package) is importable.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402
from starlette.middleware.base import BaseHTTPMiddleware  # noqa: E402
from starlette.requests import Request  # noqa: E402


class StripApiPrefix(BaseHTTPMiddleware):
    """Vercel routes /api/* to this function keeping the full path.
    FastAPI routes are registered without the /api prefix, so we strip it."""

    async def dispatch(self, request: Request, call_next):
        path = request.scope.get("path", "")
        if path.startswith("/api/"):
            request.scope["path"] = path[4:]  # strip "/api"
        if request.scope.get("raw_path"):
            raw = request.scope["raw_path"]
            if raw.startswith(b"/api/"):
                request.scope["raw_path"] = raw[4:]
        return await call_next(request)


app.add_middleware(StripApiPrefix)
