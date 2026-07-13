"""Lock decision matrix — remote flag is the authority, date only offline."""

from datetime import date, timedelta

from app.config import TRIAL_END
from app.core.guard import decide_locked

BEFORE = TRIAL_END - timedelta(days=1)
ON = TRIAL_END
AFTER = TRIAL_END + timedelta(days=30)


def test_allowed_never_locks_regardless_of_date():
    assert decide_locked("allowed", BEFORE) is False
    assert decide_locked("allowed", ON) is False
    assert decide_locked("allowed", AFTER) is False


def test_denied_always_locks_regardless_of_date():
    assert decide_locked("denied", BEFORE) is True
    assert decide_locked("denied", ON) is True
    assert decide_locked("denied", AFTER) is True


def test_offline_uses_trial_date_fallback():
    assert decide_locked("offline", BEFORE) is False
    assert decide_locked("offline", ON) is True
    assert decide_locked("offline", AFTER) is True
