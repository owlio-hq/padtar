"""Bug-report submission never ships a token and never silently drops a report."""

import pytest

import app.core.bug_reports as bug_reports


class TestConfigured:
    def test_not_configured_without_env_var(self, monkeypatch):
        monkeypatch.delenv("PADTAR_BUG_REPORT_TOKEN", raising=False)
        assert bug_reports.configured() is False

    def test_configured_with_env_var(self, monkeypatch):
        monkeypatch.setenv("PADTAR_BUG_REPORT_TOKEN", "dummy-token")
        assert bug_reports.configured() is True


class TestSubmit:
    def test_raises_report_error_when_not_configured(self, monkeypatch):
        monkeypatch.delenv("PADTAR_BUG_REPORT_TOKEN", raising=False)
        with pytest.raises(bug_reports.ReportError):
            bug_reports.submit("something broke", {})

    def test_offline_is_a_report_error_subclass(self):
        # so callers can catch either narrowly (Offline) or broadly (ReportError)
        assert issubclass(bug_reports.Offline, bug_reports.ReportError)
