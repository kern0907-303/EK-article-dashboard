# Production Run Log Sample

This document provides a sample log structure for auditing daily runs, token usage, and API costs in the Brand Intelligence OS.

---

## 1. Run Log Summary (Sample Date: 2026-06-27)

```text
2026-06-27 08:00:00 - INFO - Starting Daily Intelligence Workflow
2026-06-27 08:01:05 - INFO - Loading 102 source URLs...
2026-06-27 08:01:10 - INFO - Source Verification Completed:
                              - RSS Feeds Success Rate: 98% (49/50 feeds)
                              - HTTP Reachability Success Rate: 95.1% (97/102 resolved)
                              - Failed Sources: ['source_real_101', 'source_real_102']
2026-06-27 08:02:15 - INFO - Fetching sub-pages and crawling content...
2026-06-27 08:03:50 - INFO - Content Ingestion Completed:
                              - Sub-pages Scraped: 132 links
                              - Content Ingestion Success Rate: 94% (132/140 links)
                              - Failed Page fetches: 8 (Timed out or script blocked)
2026-06-27 08:04:10 - INFO - Filtering candidate topics against ABL Brand Configuration...
2026-06-27 08:04:12 - INFO - Guardrail Compliance: Passed. 1 forbidden word ('能量磁場') detected and rewritten.
2026-06-27 08:04:15 - INFO - Writing recommended topics and registering drafts as pending_review.
2026-06-27 08:04:18 - INFO - Daily Intelligence Workflow Completed successfully.
```

---

## 2. API Usage & Cost Breakdown

| API Provider | Model | Input Tokens | Output Tokens | Total Runs | Cost (USD) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `gpt-4o-mini` | 150,000 | 12,000 | 1 | $0.0570 |
| **Google** | `gemini-1.5-flash` | 320,000 | 18,000 | 1 | $0.0486 |
| **Mendable** | `firecrawl` | — | — | 132 pages | $0.6600 |
| **Total** | | **470,000** | **30,000** | | **$0.7656** |

---

## 3. Failed Operations & Errors log

* **Error Code: 403 Forbidden**
  - Target: `https://some-protected-blog.com/page-1`
  - Reason: Host blocked request headers.
  - Action: Automatically skipped link; crawl continued.
* **Error Code: Timeout (5000ms)**
  - Target: `https://slow-site.org/feed`
  - Reason: Connection took longer than 5 seconds.
  - Action: Fallback to cached RSS feeds.
