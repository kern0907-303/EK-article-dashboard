# Project Roadmap: Brand Intelligence OS

This roadmap describes the release schedule, dependency matrix, and key milestones for the OS implementation.

---

## 1. Timeline & Phases

```
2026-Q3 (Current)                2026-Q4                       2027-Q1
┌─────────────────────────┐     ┌───────────────────────┐     ┌─────────────────────┐
│ Phase 1: Core Engine    │ ──► │ Phase 2: Ingest/Graph │ ──► │ Phase 3: Loop/Advice│
│ - Agent/Source Registry │     │ - Web/RSS Scraper     │     │ - Decision Engine   │
│ - Capability engine     │     │ - Knowledge Graph     │     │ - Content Factory   │
│ - CLI environment       │     │ - Scorer plugins      │     │ - Learning Engine   │
└─────────────────────────┘     └───────────────────────┘     └─────────────────────┘
                                                                         │
                                                                         ▼
                                                              ┌─────────────────────┐
                                                              │ Phase 4: UI Client  │
                                                              │ - Glassmorphic SPA  │
                                                              │ - Analytics metrics │
                                                              └─────────────────────┘
```

* **Phase 1: Orchestrator Core (Duration: 2-3 Weeks)**
  * Focus: Foundation registries, capability mappings, router pipeline, and CLI runner.
* **Phase 2: Ingestors & Knowledge Graph (Duration: 3 Weeks)**
  * Focus: Event-driven crawlers, trend scrapers, SQLite node-edge graph tables, and score plugins.
* **Phase 3: Decision & Closed-Loop Feedback (Duration: 4 Weeks)**
  * Focus: Strategy briefs, Content Factory generation, and Learning weights optimization.
* **Phase 4: Web Application client (Duration: 4 Weeks)**
  * Focus: Glassmorphic web frontend, analytics chart visualizations, and Plugin UI.

---

## 2. Key Dependencies Matrix

* **Dependency 1**: `Capability Engine` ➔ Requires `Agent Registry` json profiles to match capability tags.
* **Dependency 2**: `Model Router` ➔ Requires `Capability Engine` classification output to calculate path cost.
* **Dependency 3**: `Scoring Engine` ➔ Requires `Knowledge Graph` node relationships to calculate gap metrics.
* **Dependency 4**: `Decision Engine` ➔ Requires `Scoring Engine` and `Brand Registry` weight vectors to compute P0 rankings.
* **Dependency 5**: `Learning Engine` ➔ Requires `Publish Center` click logs and `Feedback Engine` events to recalculate prompt weights.
