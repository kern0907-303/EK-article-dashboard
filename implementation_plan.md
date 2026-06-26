# Implementation Plan: Brand Guardrail & Decision Correction

This plan details the addition of a **Brand Guardrail** system and a **Source Reality Check** to the Brand Intelligence OS.

## User Review Required

> [!IMPORTANT]
> * **Brand Guardrail**: All daily decisions, topics, and marketing suggestions will be scanned for forbidden words across Erick parent, NAS, ABL, and I8 sub-brands. First-tier public copy is strictly censored and automatically rewritten to comply.
> * **Source Reality Check**: Discovered mock sources are explicitly tagged with `is_mock = true`, `source_confidence = "simulated"`, and `url_status = "unverified"`. Only verified sources (verified via search/API) can be treated as real source conclusions.

## Proposed Changes

### 1. Brand Guardrail Module

#### [NEW] [guardrail.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/guardrail.py)
* Create `BrandGuardrail` class containing check and rewrite mappings for:
  * **First-tier Public Copy**: Prohibits `能量磁場`, `信息場`, `頻率`, `調頻`, `高票價`, `無痛成交`. Rewrites them respectively to `狀態`/`承接力`, `內在狀態`, `狀態`, `調整狀態`, `高價值`, `精準定位`.
  * **ABL**: Rewrites healing promises and metaphysical vocabulary to compliant ABL phrases: `狀態`, `穩定`, `支持`, `承接力`, `內在消耗`, `身心壓力`, `自我價值`.
  * **NAS**: Prohibits `信息場`, `調頻`, `能量磁場`.
  * **I8**: Prohibits `靈性`, `頻率`, `能量場`, `顯化`, `療癒`.
  * **Erick Parent**: Reduces abstractness in public copy, allowing `關鍵因素`, `顯態/隱態`, `狀態`, `人生下半場`, `意識結構`, `隱形線索`.

---

### 2. Source Reality Check Integration

#### [MODIFY] [discovery.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/discovery.py)
* Update `SourceDiscoveryEngine` to assign properties `is_mock = true`, `source_confidence = "simulated"`, and `url_status = "unverified"` to all mock candidates.

#### [MODIFY] [models.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/models.py)
* Ensure `Source.create` accepts and records `is_mock`, `source_confidence`, and `url_status` properties in the SQLite registry.

---

### 3. Decision Engine Updates

#### [MODIFY] [decision.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/decision.py)
* Integrate `BrandGuardrail` within `DecisionEngine.generate_recommendations`.
* Filter recommended topics through the guardrail.
* Include compliance checks in the recommendation dictionary:
  * `source_is_mock` (bool)
  * `source_verified` (bool)
  * `passed_brand_guardrail` (bool)
  * `original_topic` (str)
  * `rewritten_topic` (str)
* Replace sales-heavy metaphysical topics (e.g. "如何透過 ABL 能量磁場與價值階梯無痛成交高票價諮詢") with compliant, public-friendly topics (e.g. "中年女性為什麼明明很努力，卻還是覺得狀態接不住？" or "不是妳不夠努力，而是妳的狀態已經長期過載。").

---

### 4. Verification Plan

#### Automated Tests
* Update `tests/test_source_os.py` with test cases verifying:
  * Guardrail correctly rewrites forbidden vocabulary ("能量磁場", "高票價", "無痛成交").
  * Mock URLs are flagged as unverified.
  * Daily decisions display `source_confidence` and compliance fields.
  * ABL and I8 copy contains no prohibited metaphysical words.
* Run tests: `python3 -m unittest tests/test_source_os.py`
