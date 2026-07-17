"""Update safety rules.

An update must never surprise the client or touch their data, so the pure
decision bits are pinned here: which build may self-update, and what counts as
a newer version (they hand out plain numbers — 2, then 3 or 2.1).
"""

import app.core.updater as updater
from app.core.updater import _CODE_PATHS, is_newer


class TestIsNewer:
    def test_plain_number_bump(self):
        assert is_newer("3", "2") is True

    def test_point_release_is_newer(self):
        assert is_newer("2.1", "2") is True

    def test_same_version_is_not_an_update(self):
        assert is_newer("2", "2") is False
        assert is_newer("2.1", "2.1") is False

    def test_never_prompts_to_downgrade(self):
        # if we ever roll the repo back, clients must not be told to "update"
        assert is_newer("2", "3") is False
        assert is_newer("2.9", "2.10") is False

    def test_compares_numerically_not_as_text(self):
        # "2.10" > "2.9" numerically, even though it sorts lower as a string
        assert is_newer("2.10", "2.9") is True
        assert is_newer("10", "9") is True

    def test_whitespace_and_junk_are_tolerated(self):
        assert is_newer(" 3 \n", "2") is True
        assert is_newer("abc", "2") is False


class TestUpdatesEnabled:
    def test_dev_checkout_never_self_updates(self, monkeypatch, tmp_path):
        """Regression: this used to key off frontend/dist, which is committed to
        the repo — so a dev checkout would happily overwrite its own source."""
        monkeypatch.delenv("PADTAR_SKIP_ACCESS_CHECK", raising=False)
        monkeypatch.setattr(updater, "PROJECT_ROOT", tmp_path)  # no bundled python/
        (tmp_path / "frontend" / "dist").mkdir(parents=True)  # dist present, as in dev
        assert updater.updates_enabled() is False

    def test_packaged_install_can_update(self, monkeypatch, tmp_path):
        monkeypatch.delenv("PADTAR_SKIP_ACCESS_CHECK", raising=False)
        monkeypatch.setattr(updater, "PROJECT_ROOT", tmp_path)
        (tmp_path / "python").mkdir()  # bundled runtime = the packaged app
        assert updater.updates_enabled() is True

    def test_skip_flag_disables_updates(self, monkeypatch, tmp_path):
        monkeypatch.setenv("PADTAR_SKIP_ACCESS_CHECK", "1")
        monkeypatch.setattr(updater, "PROJECT_ROOT", tmp_path)
        (tmp_path / "python").mkdir()
        assert updater.updates_enabled() is False


def test_update_only_ever_replaces_code_never_data():
    """The client's db/backups/logs must be untouchable by an update."""
    targets = [dst for _, dst in _CODE_PATHS]
    assert targets == ["backend/app", "frontend/dist", "VERSION"]
    assert not any(t.startswith("data") or "python" in t for t in targets)
