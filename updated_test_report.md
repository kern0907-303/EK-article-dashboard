# Updated Test Report: Brand Compliance & Source Verification

This report documents the verification of the Brand Guardrail rules and Source Reality Check behaviors.

## 1. Test Run Results

* **Framework**: `unittest`
* **Test File**: `tests/test_source_os.py`
* **Execution Time**: 0.019 seconds
* **Outcome**: **ALL PASSED (8/8 tests)**

---

## 2. Guardrail & Reality Check Test Cases

### Test: `test_brand_guardrail_forbidden_word_rewriter`
* **Objective**: Confirm that the guardrail detects and rewrites forbidden words like "高票價", "無痛成交", and "能量磁場" in public copywriting.
* **Outcome**: **PASS**. The input string is successfully flagged as failing, and is rewritten to use compliant terms like "高價值", "精準定位", and "狀態".

### Test: `test_source_reality_check_tags`
* **Objective**: Verify that mock candidates are properly tagged with unverified parameters, and that `source_verified` resolves to `False`.
* **Outcome**: **PASS**. The daily decision recommendation output correctly maps `is_mock = True`, `source_confidence = "simulated"`, `url_status = "unverified"`, and `source_verified = False`.

### Test: `test_brand_guardrail_context_specific_rules`
* **Objective**: Confirm that brand contexts filter unique prohibited words:
  - **ABL**: Filters healing promises (`療效`, `根治`) and metaphysical terms.
  - **I8**: Filters spiritual and energy-related words (`靈性`, `頻率`, `顯化`, `療癒`).
* **Outcome**: **PASS**. Metaphysical phrases are successfully rewritten into compliant, value-based business phrases.
