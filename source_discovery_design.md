# Source Discovery Engine Design

The **Source Discovery Engine** is responsible for scanning high-level Category taxonomies and generating Candidate Source entries to feed the registry pipelines.

## Discovery Workflow

```
Read Category ➔ Scan 10 Target Portals ➔ Generate Candidate Profiles ➔ Store as Candidate status
```

---

## The 10 Target Discovery Portals

For each Category, the discovery engine yields search queries matching:
1. **Top Websites**
2. **Top Blogs**
3. **Top YouTube Channels**
4. **Top Podcasts**
5. **Top Communities**
6. **Top News Sources**
7. **Top Newsletters**
8. **Top Sales Pages**
9. **Top Event Pages**
10. **Top Course Platforms**

---

## Pluggable Integration Hooks

The discovery engine exposes pre-registered plugin hook interfaces to easily append real API scrapers and SEO tools in production.

Available plugins configured in the system:

* **Google Search**: Crawl SERPs.
* **Google Trends**: Ingest search volume variations.
* **YouTube API**: Retrieve channel metadata and video view metrics.
* **Reddit API**: Monitor subreddit submissions.
* **Firecrawl**: Scraping website pages to markdown.
* **Apify**: Crawler orchestration.
* **RSS**: Stream feed updates.
* **SerpAPI**: Standard Google query proxy.
* **Similarweb**: Retrieve domain traffic statistics.
* **Ahrefs**: SEO keywords and backlinks analyzer.
* **Semrush**: Competitor intelligence metrics.
* **BuzzSumo**: Social engagement analyzer.
