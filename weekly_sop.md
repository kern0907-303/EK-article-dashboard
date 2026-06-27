# Weekly SOP (Standard Operating Procedure)

This document defines the weekly evaluation, tuning, and maintenance tasks for the Brand Intelligence OS.

---

## Weekly Tasks Checklist

### 1. Trend Review
* **Objective**: Evaluate changes in Google Trends and Reddit keywords.
* **Action**: Check if new key themes have surfaced in the market. Update category keyword tags in the category registry if necessary.

### 2. Source Cleanup
* **Objective**: Prune inactive or low-authority feeds from the registry.
* **Action**: Query registered active sources using `python3 run_source_os.py --list-sources`. Set sources with consistently low engagement or recurring timeout errors to `Inactive` state in the database.

### 3. Asset Analysis
* **Objective**: Measure click-through rate (CTR) and conversion metrics.
* **Action**: Audit the SQLite `Asset` table. Review the average performance of drafts. Adjust scoring parameters in the brand profile if certain formats (e.g., Reels) outperform the baseline.

### 4. Decision Quality Review
* **Objective**: Verify V3 recommendations against brand compliance.
* **Action**: Review the weekly decision stability (how often the top topic shifted). Ensure that candidate rejections (e.g., Campaign Mismatch) were accurate.

### 5. Topic Planning
* **Objective**: Align next week's themes with products.
* **Action**: Cross-reference recommended topics with upcoming events. If needed, manually register high-priority topics to bypass initial filters.

### 6. Campaign Adjustment
* **Objective**: Calibrate brand focus fields in database.
* **Action**: If a new product or marketing funnel launches, update the `current_campaign` and `current_product_focus` properties in `Brand` metadata to immediately shift decision weight scoring.
