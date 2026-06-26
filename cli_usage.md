# CLI Usage Guide: Brand Intelligence OS

This document explains the commands available in the CLI MVP (`run_source_os.py`).

## Getting Started

Initialize the system and test database by running any command. The system will automatically construct standard directories, registries, and the default Erick brand profile on the first run.

---

## 1. List Registered Categories

Lists the 25 standard categories loaded in the Category Registry.

```bash
python3 run_source_os.py --list-categories
```

**Output Preview**:
```
=== Category Registry Listing ===
Total categories registered: 25
- womens_growth: Women's Growth | Priority: Medium | Status: Active
- personal_development: Personal Development | Priority: Medium | Status: Active
...
```

---

## 2. Discover Candidate Sources

Searches and creates candidate Source objects in the database for the given category.

```bash
python3 run_source_os.py --discover "Women's Growth"
```

**Output Preview**:
```
=== Source Discovery for Category: Women's Growth ===
Found 11 candidates:
  - [Website] Sheryl Sandberg Foundation -> Saved as source_cand_0b28faaf (Candidate)
  - [Blog] Marie Forleo Blog -> Saved as source_cand_697876d1 (Candidate)
...
```

---

## 3. Score Candidates

Runs the pluggable scoring formulas and calculations on all Candidate sources in the database.

```bash
python3 run_source_os.py --score-sources
```

**Output Preview**:
```
=== Source Scoring Pipeline ===
Total candidates to score: 11
  - Scored source_cand_0b28faaf (Sheryl Sandberg Foundation): Overall Score = 72.04 -> Tier: Tier 2
  - Scored source_cand_dfe3454d (Tony Robbins Women Leadership Summit): Overall Score = 86.0 -> Tier: Tier 1
...
```

---

## 4. Promote Candidate Sources

Promotes all candidate sources with an overall score $\ge 30.0$ to the Active registry, linking them with Brand Metadata and emitting discovery events.

```bash
python3 run_source_os.py --promote-sources
```

**Output Preview**:
```
=== Source Promotion (Registry Join) ===
  - Promoted: Tony Robbins Women Leadership Summit (Score: 86.0) associated with Brand test-brand
  - Promoted: Marie Forleo Blog (Score: 70.14) associated with Brand test-brand
  - Rejected: Low Update Inactive Source (Score: 19.64 too low)
Promotion completed. 10 sources promoted to Registry.
```

---

## 5. View Source Registry Tiers

Lists all active promoted sources grouped by Tiers 1 through 4.

```bash
python3 run_source_os.py --list-sources
```

**Output Preview**:
```
=== Source Registry Listing (Tiers) ===

--- Tier 1 (1 Sources) ---
  * source_cand_dfe3454d: Tony Robbins Women Leadership Summit (Sales Page) | Score: 86.0 | Brand: test-brand

--- Tier 2 (7 Sources) ---
  * source_cand_0b28faaf: Sheryl Sandberg Foundation (Website) | Score: 72.04 | Brand: test-brand
...
```

---

## 6. Run Daily Source-Centric Workflow

Executes the complete end-to-end pipeline: Ingestion ➔ Candidate Discovery ➔ Scoring ➔ Registry Promotion ➔ AI capability routing for content extraction ➔ Knowledge Graph relationship sync.

```bash
python3 run_source_os.py --run-daily
```

**Output Preview**:
```
=== Running Daily Source-Centric Workflow ===
1. Running Auto Discovery...
   - Categories read: 25
   - Candidates discovered: 251
   - Promoted to registry: 250

2. Dispatching Task to AI Capability Orchestrator...
   - Task Classifier matched capabilities: [...]
   - Model Router sequence: CLAUDE ➔ CHATGPT ➔ CODEX
   ✔ Orchestrator mock pipeline execution completed!

3. Knowledge Graph Relations Synced:
   Category (womens_growth) ➔ Source (source_cand_5fbbffa4) ➔ Content (content_task_698d7bc4) ➔ Pattern (pattern_task_698d7bc4) ➔ Decision (decision_run_c3f1bb07)
```

---

## 7. Output Daily Strategic Decisions

Generates decision recommendations based on the top-scored active sources in the registry.

```bash
python3 run_source_os.py --daily-decision
```

**Output Preview**:
```
=== Daily Strategic Decision Output ===
🎯 今天最值得追蹤的 Source: Tony Robbins Women Leadership Summit
📝 今天最值得分析的 Content: Tony Robbins Women Leadership Summit 關於『高產值領導力與商業定位』的分享文案
💡 今天最值得寫的 Topic: 如何透過 ABL 能量磁場與價值階梯無痛成交高票價諮詢
🎬 今天最適合產出的 Content Format: Facebook 長文文案 + Reels 短影音腳本
🛡 建議理由: 該來源 (Tony Robbins Women Leadership Summit) 屬於 Sales Page...
📈 Confidence Score: 96.0%
...
```
