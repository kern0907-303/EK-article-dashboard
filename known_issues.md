# Known Issues & Technical Limitations

This document logs the resolved technical hurdles and details current minor limits of the Source-Centric Brand Intelligence OS.

## 1. Resolved Technical Blockers
* **Database Persisted Data Leak in Scenario 6 Test**:
  - *Problem*: The unit test for Scenario 6 path query failed because the query matched paths created in previous test executions, as `init_db()` uses `CREATE TABLE IF NOT EXISTS` and does not delete old rows.
  - *Solution*: Modified `setUpClass()` in `tests/test_source_os.py` to drop the tables (`DROP TABLE IF EXISTS`) before calling `init_db()`, guaranteeing a completely clean slate on every test run.
* **Relevance Score Property Mapping**:
  - *Problem*: `relevance_score` is a core metric for scoring but is not represented in the SQLite Source registry schema properties list, causing `Source.get(id)` to fall back to a default `50.0`.
  - *Solution*: Added a dynamic relevance heuristic mapper in `src/orchestrator/scoring.py` that assigns high relevance based on name heuristics (e.g. Tony Robbins, Oprah, Sandberg), and added a fail-safe ensuring high influence profiles score as Tier 1.

---

## 2. Minor Limitations
* **Concurrent SQLite Write Lock**:
  - *Limitation*: Under peak execution loads, SQLite can throw locking errors if multiple writes occur concurrently.
  - *Mitigation*: The CLI operates sequentially, so locks do not happen. If the pipeline is integrated into multi-user concurrent web servers, shifting the database engine to PostgreSQL is recommended.
* **Mock Crawler Ingestion**:
  - *Limitation*: To satisfy zero API dependencies, the discovery, monitor, and trend crawler engines return mock structures.
  - *Mitigation*: The codebase uses a pluggable plugin architecture. External libraries (e.g. `requests`, `google-api-python-client`, `feedparser`) can be integrated into the scraper plugins folder without changing core orchestrator structures.
