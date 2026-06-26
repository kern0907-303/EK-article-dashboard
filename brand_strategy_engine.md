# Brand Strategy Engine: Design & Configuration

The **Brand Strategy Engine** aligns content recommendation rankings with the core strategy vectors of Erick's brand ecosystem.

## 1. Brand Keyword Mappings

The engine scans topic texts for strategic priority keywords corresponding to each sub-brand context:

* **Erick parent brand**:
  - Keywords: `意識結構`, `隱形線索`, `人生下半場`, `健康`, `關係`, `財富`.
  - Objective: Evaluates long-term life framing and structural insights.
* **NAS**:
  - Keywords: `生命數字`, `人格`, `天賦`, `人生節奏`.
  - Objective: Connects life path numbers and personality insights.
* **ABL**:
  - Keywords: `狀態`, `承接力`, `內在消耗`, `自我價值`, `穩定`.
  - Objective: Evaluates personal capacity tuning and stress reduction.
* **I8**:
  - Keywords: `決策`, `組織`, `經營`, `團隊`, `企業承載力`.
  - Objective: Evaluates corporate scaling operations and business decision-making.

---

## 2. Weight Scoring Method

* **Brand Strategy Weight**: Adds **+5.0** points per matched priority keyword, capped at **20.0** points.
* **Audience Match**: Scans topic text for overlap with target audience segments: `35~55 女性`, `創業者`, `企業主`, `CEO`. Adds **+5.0** points per matched segment, capped at **10.0** points.
* **Current Product Match**: Applies a **+20.0** point boost if the topic contains keywords corresponding to the active focus product:
  * **Product: `人生承接力`** ➔ Matches `ABL` keywords.
  * **Product: `生命數字`** ➔ Matches `NAS` keywords.
  * **Product: `企業顧問`** ➔ Matches `I8` keywords.
