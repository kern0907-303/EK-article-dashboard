# Implementation Plan: Source-Centric Brand Intelligence OS

This plan details the migration of Brand Intelligence OS from a brand-centric design to a **Source-Centric** model.

## User Review Required

> [!IMPORTANT]
> The core entity of the system is now **Source**, and **Brand** is downgraded to metadata representing a collection of sources. All analytics, content extraction, and decision recommendations flow from the intelligence harvested from Sources.

## Open Questions
No open questions. The requirements are fully specified. We will proceed to mock API layers without external network requests, in accordance with the specifications.

## Proposed Changes

### Database & Models Layer

#### [MODIFY] [models.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/models.py)
* Update `Category` model to contain `category_id`, `name`, `description`, `keywords` (JSON list), `target_audience`, `region`, `language`, `priority`, `status`.
* Update `Source` model to support all specified attributes (scores, urls, social fields, tiers, status, created_at, updated_at).
* Update `Brand` model to act as metadata containing `brand_id`, `name`, `positioning`, `audience`, `products`, `tone`, `region`, `language`, `source_ids`, `status`.

---

### Engine Layer

#### [MODIFY] [discovery.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/discovery.py)
* Refactor `SourceDiscoveryEngine` to yield at least 10 mock candidate sources for a category (supporting `"Women's Growth"` and others).
* Include a list of future plugin registrations (e.g. `google_search`, `youtube_api`, `firecrawl`, etc.).

#### [MODIFY] [scoring.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/scoring.py)
* Refactor `SourceScoreEngine` to score Authority, Traffic, SEO, Update Frequency, Content Quality, Community Activity, Commercial Value, Trust, Influence, and Relevance to Erick Ecosystem.
* Calculate `overall_source_score`.
* Integrate pluggable scoring plugins (`opportunity_scorer`, `gap_scorer`, `roi_scorer`, and future plugins).
* Implement tier classification (Tiers 1-4).

#### [NEW] [auto_discovery.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/auto_discovery.py)
* Build the automatic discovery daily workflow: Read categories ➔ Find candidates ➔ Score ➔ Rank Tier ➔ Promote if score >= threshold ➔ Link brand metadata ➔ Emit `source_discovered` events ➔ Sync to Knowledge Graph.

#### [MODIFY] [graph.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/graph.py)
* Add a trace path method to verify Category ➔ Source ➔ Content ➔ Pattern ➔ Decision relation sequences.

#### [MODIFY] [decision.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/src/orchestrator/decision.py)
* Build decision recommendation output detailing top sources, top content, top topics, suitable formats, reasoning, and confidence scores.

#### [NEW] [run_source_os.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/run_source_os.py)
* CLI script wrapping the 7 command line tasks.

---

### Verification Plan

#### Automated Tests
* Create `tests/test_source_os.py` verifying all 7 Scenarios.
* Run tests with: `python3 -m unittest tests/test_source_os.py`

#### Manual Verification
* Run CLI commands:
  * `python3 run_source_os.py --list-categories`
  * `python3 run_source_os.py --discover "Women's Growth"`
  * `python3 run_source_os.py --score-sources`
  * `python3 run_source_os.py --promote-sources`
  * `python3 run_source_os.py --list-sources`
  * `python3 run_source_os.py --run-daily`
  * `python3 run_source_os.py --daily-decision`
