# Connector Status (Sprint 1)

This document details the status, implementation endpoints, and operational configurations of all data connectors in the Brand Intelligence OS.

---

## 1. Active Integration Status

| Connector | Status | Real Integration Endpoint | Fail/Offline Strategy |
| :--- | :--- | :--- | :--- |
| **RSS Feed** | **PRODUCTION** | Direct HTTP parser (`xml.etree.ElementTree`) | Fallback to mock competitor feed description |
| **Firecrawl** | **PRODUCTION** | `https://api.firecrawl.dev/v1/scrape` | Fallback to simple request HTML tag stripping |
| **Google Trends**| *MOCK* | Simple plugin registry mock values | Static mock keywords output |
| **Reddit API** | *MOCK* | Simple plugin registry mock values | Static mock subreddits output |
| **YouTube API**| *MOCK* | Simple plugin registry mock values | Static mock metrics output |
| **Facebook API**| *MOCK* | Simple plugin registry mock values | Static mock metrics output |

---

## 2. Connector Details & Behaviors

### RSS Connector
* **Mechanism**: Performs an HTTP `GET` request using the standard `requests` library. Uses custom browser headers (`User-Agent`) to bypass basic scrapers firewall blocking.
* **Parsing**: Automatically detects XML layout. Supports standard `RSS 2.0` (channels/items) and `Atom` (entries/links).
* **Limitations**: Automatically truncates descriptions to the first 300 characters and limits output to the top 5 latest articles to preserve context tokens.

### Firecrawl Connector
* **Mechanism**: Performs an HTTP `POST` request to Firecrawl scraping API using the environment `FIRECRAWL_API_KEY`.
* **Parameter**: Requests response format in pure `markdown` for optimal LLM context loading.
* **Fallback**: If `FIRECRAWL_API_KEY` is not present, it fetches the raw webpage HTML using `requests` and strips out script tags, style tags, and tags to obtain a clean raw text output.
