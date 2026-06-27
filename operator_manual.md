# Operator Manual

This manual provides instructions for operating the CLI and database components of the Brand Intelligence OS.

---

## 1. CLI Commands Reference

All operations are executed via [run_source_os.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/run_source_os.py) at the project root:

### Category Registry Management
* **List Categories**: Lists all registered topic categories.
  ```bash
  python3 run_source_os.py --list-categories
  ```

### Source Discovery & Scoring
* **Discover Candidates**: Pulls candidate sources for a category.
  ```bash
  python3 run_source_os.py --discover "womens_growth"
  ```
* **Score Candidates**: Runs the scoring engine on newly discovered candidates.
  ```bash
  python3 run_source_os.py --score-sources
  ```
* **Promote Candidates**: Promotes candidate sources with score $\ge 30$ to active registry.
  ```bash
  python3 run_source_os.py --promote-sources
  ```
* **List Sources**: Displays active sources sorted by Tier.
  ```bash
  python3 run_source_os.py --list-sources
  ```

### Execution & Daily Runs
* **Run Daily Workflow**: Executes discovery, scrapes top sources, dispatches tasks to capability orchestrator, extracts intelligence, writes to Knowledge Graph, and calculates Daily Decisions.
  ```bash
  python3 run_source_os.py --run-daily
  ```
* **Daily Intelligence Report**: Displays the Daily Intelligence Report, detailing new sources, scraped contents, intelligence card nodes, recommended topics, and rejected topics with reasons.
  ```bash
  python3 run_source_os.py --daily-decision
  ```

---

## 2. Managing Output Files

* **Database File**: Located at `database/orchestrator.db`. Standard SQLite file containing all objects (Brand, Source, Article, Pain Point, CTA, Pattern, Content, Decision, Asset) and relations.
* **Shared Knowledge Base**: Located at `storage/knowledge_base.md`. Chronological log of extracted competitor summaries and target claims.
* **Content Drafts**: Draft assets (Facebook posts, Reels video scripts, interactive quiz questions) are registered in the `Asset` table and saved inside the generated decision objects.
