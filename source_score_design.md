# Source Score Engine Design

The **Source Score Engine** runs evaluations on candidate feeds to determine whether they meet quality criteria and to assign operational Tiers.

## 1. The 10 Scoring Dimensions

The engine evaluates 10 criteria:
1. **Authority**: Domain authority and trust.
2. **Traffic**: Web traffic volume and page visits.
3. **SEO**: Search engine optimization score.
4. **Update Frequency**: Daily, weekly, or monthly publishing cadence.
5. **Content Quality**: Semantic richness and editorial standards.
6. **Community Activity**: Likes, comments, and member growth.
7. **Commercial Value**: Monetization index and pricing tiers.
8. **Trust**: Reliability and reputation.
9. **Influence**: Domain clout and viral reach.
10. **Relevance to Erick Ecosystem**: Alignment with high-ticket sales and ABL state adjustments.

---

## 2. Pluggable Scoring Plugins

Instead of hardcoding formulas, the engine loads active scorer plugins from the registries:

* **`opportunity_scorer`**: `Opportunity = (market heat * 0.6) + search_volume / 1000` (measures Influence).
* **`gap_scorer`**: `Gap = (10 - competitor count) * 10` (measures niche gap).
* **`roi_scorer`**: `ROI = brand fit * 11.5` (measures Commercial Value).

Future plugins can be easily integrated to support:
* *Trend Score Plugin*
* *Influence Score Plugin*
* *Difficulty Score Plugin*

---

## 3. Tier Classification Thresholds

Overall score is aggregated out of 100. Operational tracking tiers are mapped:

| Score Range | Tier Level | Description | Tracking Cadence |
| :--- | :--- | :--- | :--- |
| **Score $\ge 85.0$** | **Tier 1** | Core Sources (e.g. Tony Robbins) | Daily tracking |
| **Score $\ge 60.0$** | **Tier 2** | Important Sources | Weekly tracking |
| **Score $\ge 30.0$** | **Tier 3** | Watch Sources | Monthly tracking |
| **Score $< 30.0$** | **Tier 4** | Candidate / New Discoveries | Monthly check or discard |
