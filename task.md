# Task List: Brand Guardrail & Decision Correction

- `[ ]` Create `src/orchestrator/guardrail.py` containing rule-based brand keyword checks and rewrites.
- `[ ]` Modify `src/orchestrator/discovery.py` to tag candidates with reality checks (`is_mock`, `source_confidence`, `url_status`).
- `[ ]` Modify `src/orchestrator/models.py` to ensure Source properties store the reality check fields.
- `[ ]` Modify `src/orchestrator/decision.py` to pass suggestions through the Brand Guardrail and output compliance states.
- `[ ]` Update CLI tool `run_source_os.py` to support and display reality check fields and guardrail results.
- `[ ]` Update `tests/test_source_os.py` with test cases covering guardrail validation and reality check tagging.
- `[ ]` Verify tests pass.
- `[ ]` Create and update required documents:
  - `guardrail_implementation_summary.md`
  - `updated_test_report.md`
  - `corrected_daily_decision_sample.md`
