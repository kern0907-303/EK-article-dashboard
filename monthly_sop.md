# Monthly SOP (Standard Operating Procedure)

This document defines the monthly audits, strategy adjustments, and database maintenance tasks for the Brand Intelligence OS.

---

## Monthly Checklist & Auditing Routines

### 1. Category Review
* **Objective**: Align the Category Registry with the brand's evolving niche focuses.
* **Action**: Audit the 25 active categories in the SQLite DB. Add new niche focus fields or archive categories that no longer align with Erick's brand strategy.

### 2. Source Score Review
* **Objective**: Re-calculate all competitor source authority and relevance scores.
* **Action**: Run the score engine using `python3 run_source_os.py --score-sources` followed by `python3 run_source_os.py --promote-sources` to re-assign Tiers (Tier 1 to Tier 4) based on updated metrics.

### 3. Asset Audit
* **Objective**: Maintain database hygiene and review content productivity.
* **Action**: Clean up expired or duplicate draft entries in the `Asset` registry. Export and archive historical performance metrics (views, conversions, CTR) to a backup report.

### 4. Campaign Review
* **Objective**: Update campaign targets in the OS.
* **Action**: Evaluate the monthly campaign theme goals. Update the active campaign theme and targets in the Brand database properties.

### 5. Brand Strategy Review
* **Objective**: Fine-tune strategic weight formulas.
* **Action**: Calibrate keyword filters in `src/orchestrator/strategy.py` for each sub-brand:
  - **Erick**: Focus on consciousness structures, life planning.
  - **ABL**: Focus on state adjustment, energy stability.
  - **NAS**: Focus on numerology, life rhythm.
  - **I8**: Focus on corporate consulting, scaling capacity.
