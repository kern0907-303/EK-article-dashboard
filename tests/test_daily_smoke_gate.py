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
    def __init__(self, body=b"{}"):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.body


def _http_error(status, body=b"error"):
    return urllib.error.HTTPError("https://example.invalid", status, "error", {}, io.BytesIO(body))


class DailySmokeGateTests(unittest.TestCase):
    def test_smoke_uses_max_completion_tokens_64_without_legacy_default(self):
        requests = []

        def urlopen(request, timeout):
            requests.append(request)
            return _Response()

        with mock.patch.dict(daily.os.environ, {
            "OPENAI_API_KEY": "mock", "OPENAI_MODEL": "mock-model", "ANTHROPIC_API_KEY": "mock"
        }, clear=True), mock.patch.object(daily.urllib.request, "urlopen", side_effect=urlopen):
            result = daily.run_api_smoke_check()
        payload = json.loads(requests[0].data)
        self.assertIsNone(result["OpenAI"])
        self.assertEqual(payload["max_completion_tokens"], 64)
        self.assertNotIn("max_tokens", payload)

    def test_daily_decision_uses_max_completion_tokens_1500_without_legacy_default(self):
        requests = []
        response_body = json.dumps({"choices": [{"message": {"content": '{"recommended_topics": [], "rejected_topics": []}'}}], "usage": {}}).encode()

        def urlopen(request, timeout):
            requests.append(request)
            return _Response(response_body)

        config = {
            "focus_brand": "NAS", "campaign": "campaign", "target_audience": "audience",
            "focus_product": "product", "cta": "cta", "forbidden_terms": [],
        }
        with mock.patch.dict(daily.os.environ, {"OPENAI_API_KEY": "mock", "OPENAI_MODEL": "mock-model"}, clear=True), mock.patch.object(daily.urllib.request, "urlopen", side_effect=urlopen):
            daily.call_real_ai_daily_decision([], config)
        payload = json.loads(requests[0].data)
        self.assertEqual(payload["max_completion_tokens"], 1500)
        self.assertNotIn("max_tokens", payload)

    def test_unsupported_parameter_compatibility_fallback_retries_once(self):
        cases = (
            ("max_completion_tokens", 64, "max_tokens"),
            ("max_tokens", 64, "max_completion_tokens"),
            ("temperature", 0.2, None),
            ("response_format", {"type": "json_object"}, None),
        )
        for param, value, replacement in cases:
            with self.subTest(param=param):
                error = _http_error(400, json.dumps({"error": {"message": f"Unsupported parameter: {param}", "param": param, "code": "unsupported_parameter"}}).encode())
                with mock.patch.object(daily.urllib.request, "urlopen", side_effect=[error, _Response()]) as opened:
                    result, note = daily._openai_chat_completion({"model": "mock-model", param: value}, "mock")
                retry_payload = json.loads(opened.call_args_list[1].args[0].data)
                self.assertEqual(opened.call_count, 2)
                if replacement:
                    self.assertEqual(retry_payload[replacement], value)
                    self.assertNotIn(param, retry_payload)
                else:
                    self.assertNotIn(param, retry_payload)
                self.assertTrue(note)

    def test_unsupported_parameter_retry_is_never_more_than_once(self):
        first = _http_error(400, json.dumps({"error": {"message": "Unsupported parameter: max_completion_tokens", "param": "max_completion_tokens"}}).encode())
        second = _http_error(400, json.dumps({"error": {"message": "Unsupported parameter: max_tokens", "param": "max_tokens"}}).encode())
        with mock.patch.object(daily.urllib.request, "urlopen", side_effect=[first, second]) as opened:
            with self.assertRaises(daily.OpenAIRequestError):
                daily._openai_chat_completion({"model": "mock-model", "max_completion_tokens": 64}, "mock")
        self.assertEqual(opened.call_count, 2)

    def test_error_detail_is_limited_redacted_and_plain_text(self):
        with mock.patch.dict(daily.os.environ, {"OPENAI_API_KEY": "mock-openai-credential"}, clear=True):
            error = daily.OpenAIRequestError(400, "mock-openai-credential " + "x" * 260)
            safe = daily._plain_telegram_alert(str(error))
        self.assertLessEqual(len(error.error_message), 200)
        self.assertNotIn("mock-openai-credential", error.error_message)
        self.assertNotIn("mock-openai-credential", safe)
        self.assertFalse(any(character in safe for character in "*#`_~—─-"))

    def test_openai_error_message_is_extracted_from_http_body_and_redacted(self):
        body = json.dumps({"error": {"message": "Rejected mock-openai-credential because request is invalid", "type": "invalid_request_error"}}).encode()
        with mock.patch.dict(daily.os.environ, {"OPENAI_API_KEY": "mock-openai-credential", "OPENAI_MODEL": "mock-model"}, clear=True), \
             mock.patch.object(daily.urllib.request, "urlopen", side_effect=_http_error(400, body)):
            result = daily.run_api_smoke_check()
        self.assertIn("HTTP 400", result["OpenAI"])
        self.assertIn("Rejected", result["OpenAI"])
        self.assertNotIn("mock-openai-credential", result["OpenAI"])

    def test_malformed_openai_http_body_is_sanitized_request_error(self):
        with mock.patch.dict(daily.os.environ, {"OPENAI_API_KEY": "mock-openai-credential"}, clear=True), \
             mock.patch.object(daily.urllib.request, "urlopen", return_value=_Response(b"not-json mock-openai-credential")):
            with self.assertRaises(daily.OpenAIRequestError) as raised:
                daily._openai_chat_completion({"model": "mock-model"}, "mock-openai-credential")
        self.assertEqual(raised.exception.status, 200)
        self.assertNotIn("mock-openai-credential", raised.exception.error_message)

    def test_malformed_daily_decision_content_becomes_sanitized_request_error(self):
        config = {
            "focus_brand": "NAS", "campaign": "campaign", "target_audience": "audience",
            "focus_product": "product", "cta": "cta", "forbidden_terms": [],
        }
        body = json.dumps({"choices": [{"message": {"content": "not-json mock-openai-credential"}}]}).encode()
        with mock.patch.dict(daily.os.environ, {"OPENAI_API_KEY": "mock-openai-credential", "OPENAI_MODEL": "mock-model"}, clear=True), \
             mock.patch.object(daily.urllib.request, "urlopen", return_value=_Response(body)):
            with self.assertRaises(daily.OpenAIRequestError) as raised:
                daily.call_real_ai_daily_decision([], config)
        self.assertIn("not json", raised.exception.error_message)
        self.assertNotIn("mock-openai-credential", raised.exception.error_message)

    def test_telegram_disabled_is_not_reported_as_delivered(self):
        self.assertEqual(daily._daily_telegram_delivery_status("TELEGRAM_DISABLED: disabled", "", 0), "DISABLED")
        self.assertEqual(daily._daily_telegram_delivery_status("TELEGRAM_SEND_FAILED", "", 0), "TELEGRAM_SEND_FAILED")
        self.assertEqual(daily._daily_telegram_delivery_status("sent", "", 0), "SUCCESS")

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

    def test_daily_decision_error_is_saved_and_alerted_once(self):
        with tempfile.TemporaryDirectory() as directory:
            old = daily.os.getcwd()
            daily.os.chdir(directory)
            error = daily.OpenAIRequestError(400, "unsupported mock-openai-credential " + "x" * 240)
            try:
                with mock.patch.dict(daily.os.environ, {"OPENAI_API_KEY": "mock-openai-credential"}), \
                     mock.patch.object(daily, "run_api_smoke_check", return_value={"OpenAI": None, "Anthropic": None}), \
                     mock.patch.object(daily, "send_daily_api_alert", return_value="SUCCESS") as alert, \
                     mock.patch.object(daily, "verify_sources"), \
                     mock.patch.object(daily, "fetch_real_content_eligible", return_value=(0, [])), \
                     mock.patch.object(daily, "load_brand_strategy_config", return_value={}), \
                     mock.patch.object(daily, "get_objects_by_type", return_value=[]), \
                     mock.patch.object(daily, "call_real_ai_daily_decision", side_effect=error):
                    self.assertFalse(daily.run_daily_production_run())
                self.assertEqual(alert.call_count, 1)
                alert_errors = alert.call_args.args[1]
                self.assertIn(error.error_message, alert_errors["OpenAI"])
                self.assertNotIn("mock-openai-credential", alert_errors["OpenAI"])
                summary = next(Path("operations/daily").rglob("run_summary.md")).read_text()
                self.assertIn(error.error_message, summary)
                self.assertNotIn("mock-openai-credential", summary)
                self.assertIn("DAILY_RUN_FAILED", summary)
            finally:
                daily.os.chdir(old)

    def test_alert_is_plain_text_and_sent_once(self):
        with mock.patch.dict(daily.os.environ, {"TELEGRAM_BOT_TOKEN": "mock", "TELEGRAM_CHAT_ID": "mock"}), mock.patch.object(daily.urllib.request, "urlopen", return_value=_Response()) as opened:
            self.assertEqual(daily.send_daily_api_alert("2026-10-05", {"OpenAI": "HTTP 400 OPENAI_API_KEY=mock-token — invalid", "Anthropic": "餘額不足——#test*"}, True), "SUCCESS")
        self.assertEqual(opened.call_count, 1)
        message = json.loads(opened.call_args.args[0].data)["text"]
        self.assertFalse(any(character in message for character in "*#—─-"))
        self.assertNotIn("mock-token", message)


if __name__ == "__main__":
    unittest.main()
