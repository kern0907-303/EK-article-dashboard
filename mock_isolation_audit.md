# Mock Isolation Audit

This audit verifies the isolation and exclusion of Level 0 (mock/seeded) data assets from all operational pipelines.

---

## 1. Pipeline Exclusion Map

The following controls verify that Level 0 placeholder data cannot affect production recommendations:

* **Daily Decision Ingestion**:
  - *Status*: **Excluded**. The daily recommendation engine loads only `Content` objects having `data_quality_level = 2` and `verified_source = true` (scraped pages).
* **Topic Recommendation**:
  - *Status*: **Excluded**. Recommended topics are created strictly from the top 5 longest clean text blocks of Level 2 content.
* **Draft Generation**:
  - *Status*: **Excluded**. Generated assets link back to the parent `Content` node IDs, ensuring absolute traceability back to Level 2 web pages.
* **Source Scoring**:
  - *Status*: **Excluded**. Source verification processes live URLs, assigning Tiers only based on live pings.
* **Cost Reporting**:
  - *Status*: **Excluded**. Token estimates are calculated based on the character length of real scraped clean texts, not mock template texts.

---

## 2. Mock Isolation Verification

We verified that:
1. **Patterns and Formulas Isolation**: Legacy 1,000 patterns and 100 formulas in the registry retain `data_quality_level = 0`. They possess **no** relational links in `object_relations` pointing to any Level 2 Content nodes.
2. **Draft Assets Filter**: Draft assets created by the daily workflow only reference crawled web sub-pages, avoiding any synthetic keywords from Level 0 templates.
3. **Database separation**: The SQLite database maintains clear quality-level integer properties (`0`, `1`, `2`) on all objects, enabling direct SQL filtering of mock records.
