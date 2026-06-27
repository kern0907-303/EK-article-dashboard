# Real Data Upgrade Plan

This plan details the upgrade path to shift the libraries from Level 0 (simulated) to Level 5 (production-verified) assets.

---

## 5-Phase Upgrade Strategy

### Phase 1: Source Verification (Upgrade to Level 1)
* **Goal**: Replace the 100 generated placeholder URLs with verified, functioning competitor domains and feeds.
* **Tasks**:
  1. Compile a list of 100 competitor URLs, landing pages, and active RSS feeds.
  2. Implement an automated script to ping and verify HTTP 200 connectivity.
  3. Save the verified URLs in `objects` under type `Source` with `url_status = "verified"` and `verified = true`.

### Phase 2: Content Ingestion (Upgrade to Level 2)
* **Goal**: Fetch and store raw text and page markdown.
* **Tasks**:
  1. Set up cron jobs to run Firecrawl and RSS collectors against the 100 verified sources daily.
  2. Save raw scraped HTML/Markdown payload under a new `Article` or `Content` object type in SQLite.

### Phase 3: Agentic Pattern Extraction (Upgrade to Level 3)
* **Goal**: Extract real hooks, headlines, CTAs, and pain points.
* **Tasks**:
  1. Configure LLM Agents (Gemini/OpenAI) to analyze ingested text.
  2. Map text segments to pattern types (Headline, Hook, Pain, Desire, Offer, CTA, Story, Framework, Guarantee, Risk Reversal, Pricing, FAQ).
  3. Register extracted data as `Pattern` objects in SQLite, linking them to their source via `comes_from_source` relations.

### Phase 4: Inductive Formula Modeling (Upgrade to Level 4)
* **Goal**: Group and abstract patterns into marketing formulas.
* **Tasks**:
  1. Run aggregation routines to group recurring patterns by framework type.
  2. Identify overlapping structural models (e.g. Hooks that lead to specific Pains).
  3. Save these structures as `Formula` objects, referencing multiple source pattern IDs.

### Phase 5: Performance Data Sync (Upgrade to Level 5)
* **Goal**: Back patterns with real-world performance metrics.
* **Tasks**:
  1. Integrate analytics APIs (Google Analytics, Meta Ads Manager, or YouTube API) or set up a CSV import for manual traffic data.
  2. Sync actual CTR, impressions, and conversion metrics to the `Pattern` metadata.
  3. Update scoring algorithms in the decision engine to prioritize patterns with verified performance.
