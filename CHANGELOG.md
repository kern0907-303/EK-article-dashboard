# Changelog - Brand Intelligence OS

All notable changes to this project will be documented in this file.

---

## [0.4.0] - 2026-06-26
### Added (Final Source-Centric Pivot)
- **Category Registry**: Initialized 25 standard categories with description, language, priority, and keywords parameters.
- **Source Registry**: Shifted core operational focus from Brand-centric to Source-centric. Added 25 supported source types.
- **Brand Metadata**: Downgraded Brand registry to Brand Metadata mapping associated source lists.
- **Source Discovery Engine**: Added candidate crawlers generating mock candidate lists with pluggable SEO/scraper hooks.
- **Source Scoring & Tiering**: Integrated a 10-dimension scorer evaluating authority, traffic, SEO, quality, and relevance, classifying them into Tiers 1-4.
- **Auto Discovery Workflow**: Built daily discovery loop running ingestion, scoring, promotion, brand linkage, and event triggers automatically.
- **Source-Centric Knowledge Graph**: Configured queries to trace Category ➔ Source ➔ Content ➔ Pattern ➔ Decision relation sequences.
- **CLI Commands MVP**: Refactored CLI wrapper (`run_source_os.py`) to support the 7 key operational CLI flags.
- **Automated Scenario Tests**: Added `test_source_os.py` verifying all 7 user scenario requirements.

## [0.3.0] - 2026-06-26
### Added (Milestone 3 Completed)
- **Decision Engine**: Coded recommendations generator sorting computed opportunity scores into prioritized campaigns (Top 5 / 10).
- **Content Factory**: Coded dynamically mapped asset generators compiling drafts (FB posts, scripts, quizzes).
- **Publish Center**: Coded lifecycle states manager handling Pending review, Approved publish, and Rejected archives.
- **Feedback & Learning Loop**: Coded analytics back-propagation (views, CTR) dynamically updating brand score weight coordinates in database.

## [0.2.0] - 2026-06-26
### Added (Milestone 2 Completed)
- **Plugin Infrastructure**: Created a modular `PluginManager` supporting dynamic scraper loaders, trend harvesters, and scoring calculators.
- **Ingestion & Trend Plugins**: Implemented built-in plugins for RSS and Firecrawl scraping, Google Trends, and Reddit harvesters.
- **Knowledge Graph Node & Edge APIs**: Coded SQL-level entity traversal, query pathing, and semantic node-edge relationships.
- **Scoring Engine**: Built score calculations loading active metric plugins (Opportunity, Gap, ROI) and dynamically aggregating them via Brand weights.

## [0.1.0] - 2026-06-26
### Added (Milestone 1 Completed)
- **Universal SQLite Object Store**: Structured a single `objects` and `object_relations` (Node-Edge) graph database layout to store all 21 domain entities.
- **Agent Registry**: Created a database-backed Agent lookup mapping capabilities, speeds, and input/output formats dynamically from `capabilities.json`.
- **Task Classifier**: Implemented regex-based heuristic classification parsing prompts into capabilities, difficulties, and token requirements.
- **Model Router**: Built scoring routing sequence calculation and price saving justifications.
- **Dynamic CLI Runner**: Integrated E2E executions compiling mock outputs (FB posts, short scripts, CTAs, interactive quizzes, local code tests) and saving them as database node entities.
- **Closed-Loop Feedback**: Supported `--feedback` argument to simulate post-publish analytics back-propagation, learning updates, and decision adjustments.
- **Unit Tests Suite**: Created `test_orchestrator_core.py` covering all core components with 100% success.
