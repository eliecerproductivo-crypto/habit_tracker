import sys
from pathlib import Path

# Ensure the project root (which contains the `app` package) is importable.
# Vercel's Python runtime executes this file with the repo root on disk, but
# not always on sys.path, so we add it explicitly to be safe.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402

# Vercel's Python runtime auto-detects an ASGI-compatible `app` object exported
# from a file under /api and serves it directly — no extra adapter needed.
