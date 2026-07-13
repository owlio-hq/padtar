"""Remote access gate.

The remote flag (access.json in the GitHub repo) is the PRIMARY authority:
  allowed:false  -> lock the whole app (middleware blocks every data API).
  allowed:true   -> run normally.
The local date check is ONLY an offline fallback — when the flag can't be
fetched, the app runs until TRIAL_END and locks after it.

Lock state lives in memory only — it is never persisted, so a remote flip to
false takes effect on the next launch/check and can't be dodged by a cached
"allowed". Set PADTAR_SKIP_ACCESS_CHECK=1 (tests / dev) to make the guard inert.
"""

import json
import os
import time
import urllib.request
from datetime import date

from app.config import ACCESS_URL, TRIAL_END
from app.core.logging import logger

LOCK_MESSAGE = "Trial ended. Contact the developer for support."

_state = {"locked": False, "reason": ""}


def _skipped() -> bool:
    return os.environ.get("PADTAR_SKIP_ACCESS_CHECK") == "1"


def fetch_flag(timeout: float = 4.0) -> str:
    """Fetch the remote flag. Returns 'allowed' | 'denied' | 'offline'."""
    url = f"{ACCESS_URL}?t={int(time.time())}"  # cache-buster
    req = urllib.request.Request(
        url, headers={"Cache-Control": "no-cache", "Pragma": "no-cache", "User-Agent": "Padtar"}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return "allowed" if data.get("allowed") is True else "denied"
    except Exception:
        return "offline"


def decide_locked(flag: str, today: date | None = None) -> bool:
    """Pure lock decision — remote flag wins; date only matters offline."""
    if flag == "allowed":
        return False
    if flag == "denied":
        return True
    return (today or date.today()) >= TRIAL_END


def check_access() -> dict:
    """Refresh the in-memory lock state. Called at startup and on every
    'Check for Update'. Returns {locked, reason, flag}."""
    if _skipped():
        _state.update(locked=False, reason="")
        return {**_state, "flag": "skipped"}
    flag = fetch_flag()
    locked = decide_locked(flag)
    _state["locked"] = locked
    _state["reason"] = LOCK_MESSAGE if locked else ""
    logger.info("Access check: flag=%s locked=%s", flag, locked)
    return {**_state, "flag": flag}


def is_locked() -> bool:
    return _state["locked"]


def state() -> dict:
    return dict(_state)
