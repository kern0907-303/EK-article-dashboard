# Implementation Plan: V2 Brand Strategy Engine

This plan covers the implementation of the **Brand Strategy Engine** and the refactoring of the **Decision Engine** scoring formula.

## User Review Required

> [!IMPORTANT]
> The Decision Engine now sorts topics using a comprehensive V2 formula:
> `Final Score = Trend + Opportunity + Gap + ROI + Brand Strategy Weight + Audience Match + Current Product Match`
> Topics are ranked based on alignment with brand keywords, current focus products (e.g., `人生承接力`, `生命數字`, `企業顧問`), target audiences, and market opportunities.

## Proposed Changes

### 1. Brand Strategy Engine

#### [NEW] [strategy.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/strategy.py)
* Create `BrandStrategyEngine` class to calculate:
  * **Brand Strategy Weight**: Scans topic texts for brand priority keywords:
    * *Erick*: `意識結構`, `隱形線索`, `人生下半場`, `健康`, `關係`, `財富`.
    * *NAS*: `生命數字`, `人格`, `天賦`, `人生節奏`.
    * *ABL*: `狀態`, `承接力`, `內在消耗`, `自我價值`, `穩定`.
    * *I8*: `決策`, `組織`, `經營`, `團隊`, `企業承載力`.
  * **Audience Match**: Calculates keyword overlap with audience segments: `35~55 女性`, `創業者`, `企業主`, `CEO`.
  * **Current Product Match**: Applies a boost if a topic aligns with the active main product focus:
    * `人生承接力` (ABL products)
    * `生命數字` (NAS products)
    * `企業顧問` (I8 products)

---

### 2. Decision Engine Refactoring

#### [MODIFY] [decision.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/decision.py)
* Integrate `BrandStrategyEngine`.
* Update final score logic: `Final Score = Trend + Opportunity + Gap + ROI + Brand Strategy Weight + Audience Match + Current Product Match`.
* Update recommendation summaries to output:
  * Compliance parameters.
  * Verified source signals.
  * Active focus product and target audience.
  * Formula score breakdown per topic.

---

### 3. Verification Plan

#### Automated Tests
* Create unit tests in `tests/test_source_os.py` verifying:
  * `BrandStrategyEngine` assigns correct strategy weights for brand keywords.
  * Product boost scores are applied correctly for the active focus product.
  * Decision Engine ranks topics according to the new final score formula.
* Run tests: `python3 -m unittest tests/test_source_os.py`
