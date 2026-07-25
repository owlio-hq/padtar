"""The update endpoints must not treat a failed access.json fetch as "no internet".

A real client saw "v5 available", clicked update, and got "no internet" — while
actually online. Cause: check-update / apply-update fetched access.json first and
bailed with "offline" whenever THAT request hiccupped, even though GitHub was
reachable for the version and the code archive. The guard's own design says an
unreachable flag is an offline *fallback* (run normally before TRIAL_END), not a
hard stop — so these endpoints now decide "offline" only from the real version /
download fetch, never from the access-flag fetch.

The endpoint functions take no `db` argument, so they're called directly here —
no TestClient, no touching the real app.db.
"""

import app.main as main
from app.core import guard, updater


def _flag(monkeypatch, flag, locked=False):
    monkeypatch.setattr(guard, "check_access", lambda: {"locked": locked, "reason": "", "flag": flag})


def _enabled(monkeypatch, on=True):
    monkeypatch.setattr(updater, "updates_enabled", lambda: on)


def test_check_update_proceeds_when_access_flag_fetch_failed(monkeypatch):
    # access.json unreachable (flag 'offline') but not locked, and a real update IS there
    _flag(monkeypatch, "offline")
    _enabled(monkeypatch)
    monkeypatch.setattr(
        updater, "check_status",
        lambda force=False: {"available": True, "version": "6", "offline": False, "checked": True},
    )
    resp = main.system_check_update(force=True)
    assert resp["status"] == "available"
    assert resp["version"] == "6"


def test_check_update_still_reports_offline_when_truly_offline(monkeypatch):
    # flag fetch failed AND the version fetch failed → that's really offline
    _flag(monkeypatch, "offline")
    _enabled(monkeypatch)
    monkeypatch.setattr(
        updater, "check_status",
        lambda force=False: {"available": False, "version": "5", "offline": True, "checked": True},
    )
    assert main.system_check_update(force=True)["status"] == "offline"


def test_check_update_still_locks_a_denied_client(monkeypatch):
    # a genuine denied flag (fetch succeeded) must still gate the update
    _flag(monkeypatch, "denied", locked=True)
    _enabled(monkeypatch)
    assert main.system_check_update(force=True)["status"] == "locked"


def test_apply_update_proceeds_when_access_flag_fetch_failed(monkeypatch):
    _flag(monkeypatch, "offline")
    _enabled(monkeypatch)
    monkeypatch.setattr(updater, "apply_update", lambda: "6")
    monkeypatch.setattr(updater, "schedule_restart", lambda: None)  # never actually exit the test
    resp = main.system_apply_update()
    assert resp["status"] == "updated"
    assert resp["version"] == "6"


def test_apply_update_reports_offline_only_on_real_download_failure(monkeypatch):
    _flag(monkeypatch, "offline")
    _enabled(monkeypatch)

    def _boom():
        raise updater.Offline("Could not download the update")

    monkeypatch.setattr(updater, "apply_update", _boom)
    assert main.system_apply_update()["status"] == "offline"


def test_apply_update_still_locks_a_denied_client(monkeypatch):
    _flag(monkeypatch, "denied", locked=True)
    _enabled(monkeypatch)
    # apply_update must never even be reached for a locked client
    monkeypatch.setattr(updater, "apply_update", lambda: (_ for _ in ()).throw(AssertionError("must not apply")))
    assert main.system_apply_update()["status"] == "locked"
