# Updated Daily Decision

The Daily Decision engine now outputs structured recommendations that separate accepted topics from rejected topics, clearly detailing the reason for any filter rejections.

---

## 1. CLI Execution Output Format

Running `python3 run_source_os.py --daily-decision` produces a beautifully formatted console report using the new filtering architecture:

```text
=== Daily Strategic Decision Output ===
🎯 今天最值得追蹤的 Source: Marie Forleo Blog
📡 Source Reality Check:
  - Is Mock Source: True
  - Source Confidence: simulated
  - URL status: unverified
  - Verified source conclusion: Unverified / Simulated

🚀 Strategy Alignments (V3 System):
  - Current Focus Product: 人生承接力
  - Target Audience Segments: ['35~55 女性', '創業者', '企業主', 'CEO']
  - Active Campaign theme: 打破消耗：中年女性的狀態調整與穩定方案

🛡 Brand Guardrail Status:
  - Passed Brand Guardrail: Yes

💡 今天最值得寫的 Topic (最終推薦): 35~55 女性為什麼明明很努力，卻還是覺得狀態接不住？
🎬 今天最適合產出的 Content Format: Reels
📝 今天最值得分析的 Content: Marie Forleo Blog 關於『女性卓越成長與心態定位』的分享文案
📈 Confidence Score: 95.0%
💬 建議理由: 該主題通過所有篩選，配合當前主推產品【人生承接力】獲得最高相關性得分。最終得分：98.0分 (其中包含 品牌策略權重 5.0分，受眾契合 5.0分，主推產品加成 20.0分)。推薦格式：Reels。

=== Recommended Topics (Passed Filters) ===

  * Rank 1: 35~55 女性為什麼明明很努力，卻還是覺得狀態接不住？
    - Content Type: Reels | CTA: 預約 15 分鐘狀態調整支持電話
    - Confidence: 95.0%
    - Rationale: Trend: 18.0 | Opp: 17.0 | Gap: 15.0 | ROI: 18.0 | Brand: 5.0 | Aud: 5.0 | Prod: 20.0 | Final Score: 98.0

=== Rejected Topics (Failed Filters) ===
  ✖ 不是妳不夠努力，而是妳的狀態已經長期過載。
    - Rejection Reason: 不符合目前目標受眾
  ✖ 35~55 女性的生命數字、天賦與人生節奏定位
    - Rejection Reason: 不符合目前活動 (Campaign Mismatch)
  ✖ 企業主與 CEO 經營決策背後的企業承載力
    - Rejection Reason: 不符合目前活動 (Campaign Mismatch)
  ✖ 探索人生下半場隱形線索與意識結構的關鍵因素
    - Rejection Reason: 不符合目前目標受眾
  ✖ 35~55 女性提升狀態與自我價值的紅海競爭大眾主題
    - Rejection Reason: 市場過度飽和，且品牌差異不足
  ✖ 完全無關品牌定位的主題：如何快速修補腳踏車輪胎
    - Rejection Reason: 不符合品牌定位

本月行銷 Campaign 主題: 打破消耗：中年女性的狀態調整與穩定方案
  - 目標: 吸引 20 位潛在高階諮詢意向者
  - 目標: 完成 5 場 ABL 直播公開課
```

---

## 2. Output Schema Fields

* **today_top_topic**: The topic that achieved the highest score among survivors.
* **today_top_format**: The recommended content format, dynamically adapted by the Asset Registry.
* **recommended_topics**: List of all topics that successfully passed the 7 filters. Each contains `topic`, `content_type`, `cta`, `reason` (showing all weight score components), and `confidence`.
* **rejected_topics**: List of all topics failed by the filters. Each contains `topic` and a descriptive `reason` (e.g. Campaign Mismatch, brand language violations, or market saturation).
