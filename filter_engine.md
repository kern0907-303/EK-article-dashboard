# Filter Engine

The **Filter Engine** (`src/orchestrator/filter_engine.py`) serves as the pre-ranking vetting system. It processes raw candidate topics sequentially through 7 rules to determine if they are qualified to move forward to scoring and final ranking.

---

## 1. The 7 Filters

| Filter Stage | Check Description | Failure Action |
| :--- | :--- | :--- |
| **1. Brand Filter** | Validates if the topic contains keywords matching the brand ecosystem's strategy. | Rejects with `"不符合品牌定位"` |
| **2. Audience Filter**| Verifies that the topic matches target demographics (e.g. `35~55 女性`, `創業者`, `CEO`). | Rejects with `"不符合目前目標受眾"` |
| **3. Campaign Filter**| Inspects alignment with active campaign themes (e.g. `打破消耗`). | Rejects with `"不符合目前活動 (Campaign Mismatch)"` |
| **4. Product Filter** | Checks alignment with the focus product currently prioritized. | Rejects with `"不符合目前主推產品"` |
| **5. Guardrail Filter**| Scans for forbidden metaphysical terms. Automatically rewrites the topic if minor violations are found. | Auto-rewrites topic |
| **6. Asset Filter** | Audits the Asset Registry. Rejects if total assets $\ge 50$. Applies auto-adaptation. | Rejects with `"已有大量內容"` or adapts format |
| **7. Competition Filter**| Checks market competition levels. Rejects if competition is high and brand differentiation is low. | Rejects with `"市場過度飽和，且品牌差異不足"` |

---

## 2. Format Auto-Adaptation Rules

In Filter Stage 6 (Asset Filter), the engine dynamically shifts recommended content formats based on existing publishing volume for the target topic:

1. **Facebook $\rightarrow$ Reels**:
   If a topic already has **30 or more Facebook posts** in the Asset Registry, the recommended format is automatically updated to **Reels** to avoid audience fatigue.
   $$\text{Facebook count} \ge 30 \implies \text{Format} = \text{"Reels"}$$

2. **Blog $\rightarrow$ Lecture**:
   If a topic has been published as a **Blog post (Article) at least once**, but no **Lecture** has been created, the recommended format is updated to **Lecture** to reuse high-performing written material as speaking topics.
   $$\text{Blog count} \ge 1 \land \text{Lecture count} == 0 \implies \text{Format} = \text{"Lecture"}$$

---

## 3. Market Saturation Rules

In Filter Stage 7 (Competition Filter), the engine reviews market parameters:
* If a topic has a `competition_level` of **"high"**:
  * The topic's `brand_differentiation` score must be **$\ge 60.0$** to pass.
  * If the differentiation is **$< 60.0$**, the topic is immediately rejected with `"市場過度飽和，且品牌差異不足"`.
