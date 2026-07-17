"""Client-facing bug reporting.

Turns "something's wrong" into a GitHub issue on the same repo the updater
already watches, so a problem reaches the developer without the client needing
a GitHub account or to write an email. Never applied/automated beyond that —
the client always sees what's being sent and clicks Submit themselves.

Requires PADTAR_BUG_REPORT_TOKEN in the environment (a fine-grained GitHub PAT
scoped to "Issues: write" on this one repo). Until that's set on the packaged
machine, configured() is False and the app tells the client reporting isn't
set up yet — it never silently drops a report or ships a token in the code.
"""

import json
import os
import urllib.error
import urllib.request

from app.config import APP_NAME, BUG_REPORT_TOKEN_ENV, ISSUES_API_URL, app_version
from app.core.logging import logger


class ReportError(RuntimeError):
    """Could not send the report. Message is safe to show the client."""


class Offline(ReportError):
    """Couldn't reach GitHub."""


def configured() -> bool:
    return bool(os.environ.get(BUG_REPORT_TOKEN_ENV))


def submit(description: str, context: dict) -> str:
    """POST a new issue to GitHub. Returns the issue URL, or raises Offline/ReportError."""
    token = os.environ.get(BUG_REPORT_TOKEN_ENV)
    if not token:
        raise ReportError("Bug reporting isn't set up on this copy yet.")

    first_line = next((line for line in description.strip().splitlines() if line.strip()), "Problem reported from Padtar")
    title = first_line[:80]
    body = (
        f"**Reported from the app**\n\n{description.strip()}\n\n---\n"
        f"Version: {context.get('version') or app_version()}\n"
        f"Page: {context.get('url') or '—'}\n"
        f"When: {context.get('timestamp') or '—'}\n"
        f"Auto-detected: {'yes' if context.get('auto') else 'no'}\n"
    )
    payload = json.dumps({"title": title, "body": body, "labels": ["client-report"]}).encode("utf-8")
    req = urllib.request.Request(
        ISSUES_API_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": APP_NAME,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            logger.info("Bug report sent: %s", data.get("html_url"))
            return data.get("html_url", "")
    except urllib.error.HTTPError as exc:
        logger.error("Bug report failed (HTTP %s): %s", exc.code, exc.reason)
        raise ReportError("Could not send the report right now. Try again later.") from exc
    except urllib.error.URLError as exc:
        raise Offline("No internet connection — could not send the report") from exc
    except Exception as exc:
        logger.error("Bug report failed: %s", exc)
        raise ReportError("Could not send the report right now. Try again later.") from exc
