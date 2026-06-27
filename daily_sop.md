# Daily SOP (Standard Operating Procedure)

This document defines the daily execution schedule and commands for operating the Brand Intelligence OS.

---

## Daily Schedule & Execution Details

| Time | Stage | Action & Command | Description |
| :--- | :--- | :--- | :--- |
| **08:00** | **Collect Sources** | `python3 run_source_os.py --discover "Women's Growth"` | Triggers automated source discovery to pull candidate feeds and URLs into the Candidate Registry. |
| **08:10** | **Analyze Content** | Automated within workflow / `python3 run_source_os.py --run-daily` | Scrapes target content using Firecrawl/RSS, runs Gemini to extract markdown, and Claude to output structured Intelligence Cards (Pain Points, CTAs, Hooks). |
| **08:20** | **Generate Daily Decision** | `python3 run_source_os.py --daily-decision` | Routes candidate topics through the V3 sequential filtering pipeline (Brand ➔ Audience ➔ Campaign ➔ Product ➔ Guardrail ➔ Asset ➔ Competition). |
| **08:30** | **Generate Drafts** | Automated within daily workflow | Invokes ChatGPT Agent (`gpt-4o-mini`) to translate the top recommended topic into brand-compliant draft Facebook posts, Reels video scripts, and interactive quizzes. |
| **08:40** | **Update Asset Registry** | Automated within daily workflow | Registers newly drafted assets, assigning `asset_id`, `topic`, `content_type` (Facebook/Reels/Blog/etc.), and timestamp in the `Asset` table. |
| **08:50** | **Generate Daily Report** | Output generated at workflow completion | Outputs the structured **Daily Intelligence Report** directly to the terminal, detailing New Sources, New Contents, Top 5 Intelligence, Top 3 Recommendations, and Rejected Topics with reasons. |
