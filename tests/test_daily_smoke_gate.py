"""Offline checks for the daily provider gate and its single alert."""

import io
import json
import os
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

from src.orchestrator import data_acquisition as daily


class _Response:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return b"{}"


def _http_error(status, body=b"error"):
    return urllib.error.HTTPError("https://example.invalid", status, "error", {}, io.BytesIO(body))


class DailySmokeGateTests(unittest.TestCase):
    def test_anthropic_failure_does_not_block_openai(self):
        calls = []

        def urlopen(request, timeout):
            calls.append(request.full_url)
            if "anthropic" in request.full_url:
                raise _http_error(400, b"Your credit balance is too low to access the Anthropic API")
            return _Response()

        with mock.patch.dict(daily.os.environ, {
            "OPENAI_API_KEY": "mock", "OPENAI_MODEL": "mock-model", "ANTHROPIC_API_KEY": "mock"
        }), mock.patch.object(daily.urllib.request, "urlopen", side_effect=urlopen):
            result = daily.run_api_smoke_check()
        self.assertIsNone(result["OpenAI"])
        self.assertEqual(result["Anthropic"], "餘額不足 (HTTP 400)")
        self.assertEqual(len(calls), 2)

    def test_transient_http_retries_once_but_bad_request_and_auth_do_not(self):
        for status, expected_calls in ((429, 2), (503, 2), (400, 1), (401, 1), (403, 1)):
            with self.subTest(status=status):
                with mock.patch.object(daily.urllib.request, "urlopen", side_effect=lambda *_a, **_kw: (_ for _ in ()).throw(_http_error(status))) as opened:
                    reason = daily._smoke_request(daily.urllib.request.Request("https://example.invalid"))
                self.assertEqual(opened.call_count, expected_calls)
                self.assertIn(f"HTTP {status}", reason)

    def test_network_timeout_retries_once(self):
        with mock.patch.object(daily.urllib.request, "urlopen", side_effect=TimeoutError()) as opened:
            self.assertEqual(daily._smoke_request(daily.urllib.request.Request("https://example.invalid")), "逾時或網路錯誤")
        self.assertEqual(opened.call_count, 2)

    def test_missing_openai_model_is_reported_without_request(self):
        with mock.patch.dict(daily.os.environ, {"OPENAI_API_KEY": "mock", "ANTHROPIC_API_KEY": "mock"}, clear=True), mock.patch.object(daily.urllib.request, "urlopen", return_value=_Response()) as opened:
            result = daily.run_api_smoke_check()
        self.assertIn("OPENAI_MODEL", result["OpenAI"])
        self.assertEqual(opened.call_count, 1)

    def test_openai_failure_stops_without_report_and_alerts_once(self):
        for errors in (
            {"OpenAI": "限流 (HTTP 429)", "Anthropic": None},
            {"OpenAI": "限流 (HTTP 429)", "Anthropic": "餘額不足 (HTTP 400)"},
        ):
            with self.subTest(errors=errors), tempfile.TemporaryDirectory() as directory:
                old = os.getcwd()
                os.chdir(directory)
                try:
                    with mock.patch.object(daily, "run_api_smoke_check", return_value=errors), mock.patch.object(daily, "send_daily_api_alert", return_value="SUCCESS") as alert, mock.patch.object(daily, "call_real_ai_daily_decision") as report:
                        self.assertFalse(daily.run_daily_production_run())
                    self.assertEqual(alert.call_count, 1)
                    report.assert_not_called()
                    self.assertFalse(list(Path("operations/daily").rglob("daily_morning_brief.md")))
                    summary = next(Path("operations/daily").rglob("run_summary.md")).read_text()
                    self.assertIn(errors["OpenAI"], summary)
                    if errors["Anthropic"]:
                        self.assertIn(errors["Anthropic"], summary)
                finally:
                    os.chdir(old)

    def test_anthropic_only_failure_continues_and_warns_once(self):
        with tempfile.TemporaryDirectory() as directory:
            old = daily.os.getcwd()
            daily.os.chdir(directory)
            try:
                with mock.patch.object(daily, "run_api_smoke_check", return_value={"OpenAI": None, "Anthropic": "餘額不足 (HTTP 400)"}), mock.patch.object(daily, "send_daily_api_alert", return_value="SUCCESS") as alert, mock.patch.object(daily, "verify_sources"), mock.patch.object(daily, "fetch_real_content_eligible", return_value=(0, [])), mock.patch.object(daily, "load_brand_strategy_config", return_value={}), mock.patch.object(daily, "get_objects_by_type", return_value=[]), mock.patch.object(daily, "call_real_ai_daily_decision", side_effect=RuntimeError("reached report stage")):
                    with self.assertRaisesRegex(RuntimeError, "reached report stage"):
                        daily.run_daily_production_run()
                self.assertEqual(alert.call_count, 1)
            finally:
                daily.os.chdir(old)

    def test_alert_is_plain_text_and_sent_once(self):
        with mock.patch.dict(daily.os.environ, {"TELEGRAM_BOT_TOKEN": "mock", "TELEGRAM_CHAT_ID": "mock"}), mock.patch.object(daily.urllib.request, "urlopen", return_value=_Response()) as opened:
            self.assertEqual(daily.send_daily_api_alert("2026-10-05", {"OpenAI": None, "Anthropic": "餘額不足——#test*"}, True), "SUCCESS")
        self.assertEqual(opened.call_count, 1)
        message = json.loads(opened.call_args.args[0].data)["text"]
        self.assertFalse(any(character in message for character in "*#—─-"))


if __name__ == "__main__":
    unittest.main()
