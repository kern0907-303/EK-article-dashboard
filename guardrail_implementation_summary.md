# Brand Guardrail & Source Reality Check: Implementation Summary

This document summarizes the brand compliance rules, auto-rewriting mechanisms, and source reality check parameters implemented for the Brand Intelligence OS.

## 1. Brand Guardrail Module (`guardrail.py`)

A rule-based censoring and rewriting engine checks and sanitizes all generated topics, content suggestions, and copy.

### Context Rules
* **First-tier Public Copy**: Prohibits metaphysical or sales-heavy vocabulary: `能量磁場`, `信息場`, `頻率`, `調頻`, `高票價`, `無痛成交`.
* **ABL Context**: Restricts healing promises (`療效`, `根治`, `治癒`) and metaphysical wording, shifting terminology to ABL-compliant words: `狀態`, `穩定`, `支持`, `承接力`, `內在消耗`, `身心壓力`, `自我價值`.
* **NAS Context**: Prohibits `信息場`, `調頻`, `能量磁場`.
* **I8 Context**: Prohibits `靈性`, `頻率`, `能量場`, `顯化`, `療癒`.
* **Erick Parent**: Reduces abstractness in public output.

### Word Mapping Replacements
* `能量磁場` / `能量場` ➔ `狀態` / `承接力`
* `信息場` ➔ `內在狀態`
* `頻率` ➔ `狀態`
* `調頻` ➔ `調整狀態`
* `高票價` ➔ `高價值`
* `無痛成交` ➔ `精準定位`
* `顯化` ➔ `具體呈現`
* `療癒` ➔ `支持與舒緩`
* `靈性` ➔ `內在意識`

---

## 2. Source Reality Check (`discovery.py` & `models.py`)

All generated mock candidates are marked with reality check attributes to prevent treating unverified crawlers as authentic source conclusions:
* `is_mock = true`
* `source_confidence = "simulated"`
* `url_status = "unverified"`

Only sources validated through real API searches in the future will set `is_mock = false` and `url_status = "verified"`.

---

## 3. Decision Integration (`decision.py`)

The `DecisionEngine` runs suggested topics and rationale through the `BrandGuardrail` before outputting final recommendations. The daily recommendation payload now includes:
* `is_mock` (Source Mock Status)
* `source_confidence` (Confidence level)
* `url_status` (URL validity)
* `source_verified` (Boolean verification check)
* `passed_brand_guardrail` (Compliance check result)
* `original_topic` (Original raw topic if failed)
* `rewritten_topic` (Corrected brand-compliant topic)
