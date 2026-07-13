from datetime import date
from pathlib import Path

APP_NAME = "Padtar"

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent

DATA_DIR = PROJECT_ROOT / "data"
BACKUPS_DIR = DATA_DIR / "backups"
LOGS_DIR = DATA_DIR / "logs"

DATA_DIR.mkdir(exist_ok=True)
BACKUPS_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "app.db"
LOG_PATH = LOGS_DIR / "app.log"

HISTORY_SNAPSHOTS_PER_ENTRY = 5

# Built frontend (npm run build output). Present in the packaged distributable;
# absent in normal dev (where Vite's own dev server serves the frontend instead).
FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"

# --- remote access control + manual updates (see core/guard.py, core/updater.py) ---
# The GitHub repo is the single remote authority: access.json gates the app,
# VERSION + the branch zipball drive manual updates. Public repo — no token.
UPDATE_REPO = "owlio-hq/padtar"
UPDATE_BRANCH = "main"
ACCESS_URL = f"https://raw.githubusercontent.com/{UPDATE_REPO}/{UPDATE_BRANCH}/access.json"
REMOTE_VERSION_URL = f"https://raw.githubusercontent.com/{UPDATE_REPO}/{UPDATE_BRANCH}/VERSION"
UPDATE_ZIP_URL = f"https://codeload.github.com/{UPDATE_REPO}/zip/refs/heads/{UPDATE_BRANCH}"
# Offline-only fallback: with no internet, the app runs until this date, then locks.
TRIAL_END = date(2026, 8, 14)
VERSION_FILE = PROJECT_ROOT / "VERSION"


def app_version() -> str:
    try:
        return VERSION_FILE.read_text().strip()
    except OSError:
        return "0"
