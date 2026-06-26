# Detailed Task Breakdown: Brand Intelligence OS

This task breakdown defines the specific tasks, dependencies, priorities, hours, acceptance criteria, and done definitions for each implementation phase.

---

## Phase 1: Orchestration Core & CLI (MVP Backbone)

### TSK-101: Universal SQLite Object DB Setup
* **Title**: Universal SQLite Object Database Setup
* **Description**: Implement `src/database.py` with `objects` and `object_relations` schemas to store all 21 domain entities as generic objects with JSON properties.
* **Dependency**: None
* **Priority**: P0
* **Estimated Hours**: 4 hours
* **Acceptance Criteria**: Running `python3 src/database.py` creates `orchestrator.db` with correct tables, and inserting custom JSON objects and edge links works without errors.
* **Done Definition**: database initialization script verified, unit test passes.

### TSK-102: Agent Registry JSON & Loader
* **Title**: Agent Registry JSON & Loader Setup
* **Description**: Create `config/capabilities.json` defining profiles for Gemini, Claude, ChatGPT, Codex, and Cowork. Implement a loader class to parse, register, and query agents dynamically.
* **Dependency**: TSK-101
* **Priority**: P0
* **Estimated Hours**: 3 hours
* **Acceptance Criteria**: Code can load agent list, search for agents holding specific capability tags (e.g. 'scraping'), and retrieve their pricing.
* **Done Definition**: capabilities.json populated, registry class tests pass.

### TSK-103: Task Classifier Implementation
* **Title**: Task Classifier Keyword Logic
* **Description**: Implement `src/orchestrator/classifier.py` using regex and heuristics to parse a prompt, extract required capability tags, task type, difficulty, and tokens.
* **Dependency**: None
* **Priority**: P0
* **Estimated Hours**: 4 hours
* **Acceptance Criteria**: Inputting a prompt like "分析競品並轉譯文案" outputs required capabilities list: `["deep_analysis", "brand_translation", "copywriting"]`.
* **Done Definition**: classifier.py created, all regex test patterns validated.

### TSK-104: Capability Engine & Model Router
* **Title**: Capability Engine & Model Router
* **Description**: Implement `src/orchestrator/router.py` to cross-reference classifier output with the Agent Registry, select optimal models, assign capabilities, calculate routing sequence, and output cost/saving estimations.
* **Dependency**: TSK-102, TSK-103
* **Priority**: P0
* **Estimated Hours**: 6 hours
* **Acceptance Criteria**: Router assigns coding capabilities to Codex only, scraping to Gemini, analysis to Claude, copywriting to ChatGPT, and outputs the correct path array.
* **Done Definition**: Router logic implemented, routing test suite passes.

### TSK-105: Source & Brand Registry SQLite Mapping
* **Title**: Source & Brand Registry SQLite Mapping
* **Description**: Write wrapper classes to manage Brand and Source domain objects in the database. Ensure Brands support score weights, forbidden words, and methodologies.
* **Dependency**: TSK-101
* **Priority**: P0
* **Estimated Hours**: 4 hours
* **Acceptance Criteria**: Creating a brand with methodology details saves successfully in database as type 'Brand', and adding sources creates correct relational links.
* **Done Definition**: wrapper classes completed, CRUD unit tests pass.

### TSK-106: CLI Runner & Event Bus Simulator
* **Title**: CLI Runner & Event Bus Simulator
* **Description**: Create `run_orchestrator.py` CLI interface. Integrates Event Bus simulator to dispatch events and run classification, routing, mock execution, and output reports.
* **Dependency**: TSK-104, TSK-105
* **Priority**: P0
* **Estimated Hours**: 6 hours
* **Acceptance Criteria**: Running `python3 run_orchestrator.py` executes the entire pipeline, prints the 6-part report (Classification, Match, Route, Cost, Mock Outputs, Handoff Link) to the terminal using colors.
* **Done Definition**: CLI script complete, test prompts pass, documentation updated.

---

## Phase 2: Ingestors & Knowledge Graph

### TSK-201: Ingestion Scraper Plugins
* **Title**: Ingestion Scraper Plugins (Web/RSS)
* **Description**: Implement monitor plugin wrappers that can load external scraper classes (RSS parser, web crawler) to fetch raw competitor content and emit `content_ingested` events.
* **Dependency**: TSK-106
* **Priority**: P1
* **Estimated Hours**: 8 hours
* **Acceptance Criteria**: Ingesting an RSS feed URL downloads the feeds and adds them as `Article` objects in the SQLite database.
* **Done Definition**: Scraper wrapper implemented, mock integration tested.

### TSK-202: Trend Monitor Plugin
* **Title**: Trend Monitor Plugin
* **Description**: Implement trend plugins to fetch daily and weekly keywords from Google Trends RSS and subreddits, registering them as `Trend` objects in the database.
* **Dependency**: TSK-106
* **Priority**: P1
* **Estimated Hours**: 6 hours
* **Acceptance Criteria**: Trend module parses external XML/API payload and logs trending keywords in SQLite.
* **Done Definition**: Trend plugin implemented, integration tests pass.

### TSK-203: Knowledge Graph API Setup
* **Title**: Knowledge Graph Node & Edge API
* **Description**: Implement helper methods to write, query, and traverse node-edge relations representing Brands, Pain Points, CTAs, and Patterns in SQLite.
* **Dependency**: TSK-101
* **Priority**: P1
* **Estimated Hours**: 8 hours
* **Acceptance Criteria**: Inserting a `pain_point` node and linking it to a `brand` node with relation `solves_pain` writes successfully and can be queried.
* **Done Definition**: Graph CRUD helper methods pass unit tests.

### TSK-204: Scoring Engine & Score Plugins
* **Title**: Scoring Engine & Score Plugins Setup
* **Description**: Implement Scoring Engine that loads metric plugins (Opportunity, Gap, ROI) dynamically, calculates scores, and aggregates them using Brand weights.
* **Dependency**: TSK-203
* **Priority**: P1
* **Estimated Hours**: 6 hours
* **Acceptance Criteria**: Calculator retrieves active plugins, runs mathematical evaluations, and outputs a sorted list of scoring models.
* **Done Definition**: Scoring engine classes pass tests.

---

## Phase 3: Decisions & Closed-Loop Feedback

### TSK-301: Decision Engine Recommendations
* **Title**: Decision Engine Advisor Recommendations
* **Description**: Implement Decision Engine to query opportunities, filter via brand strategy, and output Today's Top 5, Weekly Top 10, and Campaigns with confidence scores.
* **Dependency**: TSK-204
* **Priority**: P0
* **Estimated Hours**: 8 hours
* **Acceptance Criteria**: The advisor generates structured briefs containing priority, impact rationale, and confidence scores.
* **Done Definition**: Decision engine completed, unit tests pass.

### TSK-302: Content Factory Asset Generator
* **Title**: Content Factory Generator Plugins
* **Description**: Build generators that read brand prompts and briefs, invoking agents dynamically to compile FB posts, video scripts, CTAs, and interactive quizzes.
* **Dependency**: TSK-106, TSK-301
* **Priority**: P0
* **Estimated Hours**: 10 hours
* **Acceptance Criteria**: Factory outputs complete markdown/JSON structures for all requested marketing platforms.
* **Done Definition**: Asset generators complete, output schemas verified.

### TSK-303: Publish Center Queue
* **Title**: Publish Center States Manager
* **Description**: Implement state transitioning interface (Draft ➔ Pending ➔ Approved ➔ Published/Rejected) for content assets.
* **Dependency**: TSK-302
* **Priority**: P1
* **Estimated Hours**: 4 hours
* **Acceptance Criteria**: Transitioning an asset to 'Approved' creates mock publication logs and stores them in SQLite.
* **Done Definition**: Status manager verified.

### TSK-304: Feedback & Learning Loop
* **Title**: Feedback Ingestion & Weight Calibration
* **Description**: Build feedback events collector and Learning Engine to adjust Brand prompt/score weights based on simulated analytics data (views, CTR).
* **Dependency**: TSK-303
* **Priority**: P1
* **Estimated Hours**: 8 hours
* **Acceptance Criteria**: Submitting post CTR metrics automatically updates `brand.score_weights` in database.
* **Done Definition**: Feedback pipeline passes E2E test.

---

## Phase 4: Client Dashboard & Analytics

### TSK-401: Glassmorphic UI Cockpit
* **Title**: Glassmorphic SPA Frontend
* **Description**: Build a premium vanilla HTML/CSS/JS frontend dashboard to manage registries, monitor sources, and approve generated content.
* **Dependency**: TSK-303
* **Priority**: P2
* **Estimated Hours**: 16 hours
* **Acceptance Criteria**: UI loads cockpit, registries, and approval drawers correctly with glassmorphism styling and smooth animations.
* **Done Definition**: Web frontend files complete.

### TSK-402: FastAPI endpoints Integration
* **Title**: REST API Endpoints Integration
* **Description**: Build FastAPI router paths to serve UI assets and manage DB registries, graph nodes, and queues.
* **Dependency**: TSK-401
* **Priority**: P2
* **Estimated Hours**: 8 hours
* **Acceptance Criteria**: REST API handles source registration, content queries, and approval actions successfully.
* **Done Definition**: REST API endpoints pass integration checks.

### TSK-403: Graph Visualizer Component
* **Title**: Knowledge Graph SVG Visualizer
* **Description**: Build an SVG/canvas-based visualizer in the dashboard to explore links between pain points, CTAs, and patterns.
* **Dependency**: TSK-401, TSK-203
* **Priority**: P3
* **Estimated Hours**: 8 hours
* **Acceptance Criteria**: Visualizer renders node circles and edge lines based on database graph records.
* **Done Definition**: SVG component verified.
