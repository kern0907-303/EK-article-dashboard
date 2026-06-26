# Walkthrough: Source-Centric Brand Intelligence OS CLI MVP

We have successfully re-architected the system under `/Users/erickair/.gemini/antigravity/scratch/ai_content_factory/` to prioritize **Source Intelligence** over Brand properties.

---

## 1. Relational Layout Traversal

The system database has been updated so that entities connect according to the following dependency path:
```
Category ➔ Source ➔ Content ➔ Pattern ➔ Decision
```
* **Category Registry**: 25 standard industry classes.
* **Source Registry**: The core collector feeds (Website, YouTube, Podcast, Social, etc.).
* **Brand Metadata**: Downgraded metadata mapping associated sources.

---

## 2. Command Line Execution Walkthrough

The CLI can be launched using 7 specific flags:

### A. Category Registry Listing
```bash
python3 run_source_os.py --list-categories
```
Lists the 25 predefined categories loaded dynamically from the registry.

### B. Discover Candidates
```bash
python3 run_source_os.py --discover "Women's Growth"
```
Triggers discovery scan yielding 11 candidate sources of different types (Websites, Blogs, Podcasts, YouTube, Threads, etc.) and registers them as Candidates.

### C. Evaluate and Score Candidates
```bash
python3 run_source_os.py --score-sources
```
Calculates scores across 10 distinct quality dimensions (e.g. Authority, Traffic, Trust, Relevance) using pluggable Opportunity, Gap, and ROI plugins.

### D. Promote to Registry
```bash
python3 run_source_os.py --promote-sources
```
Promotes all candidates with score $\ge 30.0$ to Active status, dynamically link them to the default Brand Metadata profile, and emit event triggers.

### E. List Sources by Tiers
```bash
python3 run_source_os.py --list-sources
```
Prints all active sources grouped into Tiers 1 through 4 (Tier 1 core tracked daily, Tier 4 candidate tracked rarely).

### F. Run Daily Pipeline
```bash
python3 run_source_os.py --run-daily
```
Runs the full workflow:
1. Ingests categories and auto-discovers candidates.
2. Evaluates scores and promotes active sources.
3. Automatically routes tasks through the AI Orchestrator (e.g., Gemini ➔ Claude ➔ ChatGPT) to analyze the top active source's content.
4. Generates decision recommendations and writes Category ➔ Source ➔ Content ➔ Pattern ➔ Decision traversals to the Knowledge Graph.

### G. Output Daily Strategic Decisions
```bash
python3 run_source_os.py --daily-decision
```
Compiles and prints the daily report answering the top source, top topic, suitable format, rationale, and confidence rating.

---

## 3. Automated Test Execution

All scenarios are fully verified by running:
```bash
python3 -m unittest tests/test_source_os.py
```
This test suite verifies:
* **Scenario 1**: Yields $\ge 10$ candidates for Women's Growth.
* **Scenario 2/3/4**: Correctly scores Tony Robbins as Tier 1, inactive sources as Tier 4, and classifies tiers.
* **Scenario 5**: Auto-links Brand Metadata and source IDs upon promotion.
* **Scenario 6**: Traverses the Knowledge Graph sequence path.
* **Scenario 7**: Daily decisions match the strategic schema.
