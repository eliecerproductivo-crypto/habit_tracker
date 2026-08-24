# Load a local .env file (if present) before any submodule reads os.environ.
# On Vercel, env vars come from Project Settings instead, and .env won't exist —
# load_dotenv() simply no-ops in that case. wow
from dotenv import load_dotenv

load_dotenv()
