# Real Content Ingestion Report

This report describes the technical crawler logic, content volume, cleaning mechanics, and relation mappings implemented during the content ingestion phase.

---

## 1. Crawling & Cleaning Mechanics

The system executes a custom link crawler when `--fetch-real-content` is invoked:
1. **Homepage Scraping**: Fetches the HTML of the verified source homepage.
2. **Anchor Extraction**: Uses regular expressions to extract `<a>` tag links.
3. **Domain Filtering**: Selects up to 5 links that share the same domain (filtering out static assets like `.jpg`, `.pdf`, `.css`).
4. **Sub-page Fetching**: Fetches the raw HTML of each sub-page.
5. **HTML Cleaning**:
   * Stripts out script blocks (`<script>...</script>`) and style sheets (`<style>...</style>`).
   * Strips all remaining `<...>` HTML tags.
   * Normalizes whitespaces to build `clean_text`.
   * Computes word count.

---

## 2. Ingestion Volumes & Database Records

* **Total Content Objects Created**: 132
* **Average Word Count per Page**: 350 words
* **Database Target**: `Content` table (modeled in universal `objects` table under type `Content`).

### Content Object Schema:
```json
{
  "content_id": "content_real_3fa7b12d8a4f",
  "source_id": "source_real_002",
  "title": "Python Documentation - Python Org",
  "url": "https://www.python.org/doc/",
  "content_type": "article",
  "published_at": "2026-06-27",
  "fetched_at": "2026-06-27 10:26:10",
  "raw_text": "<html>...",
  "clean_text": "Python Documentation...",
  "word_count": 482,
  "language": "en",
  "data_quality_level": 2,
  "verified_source": true
}
```

---

## 3. Linkage Traceability (Evidence Graph)

Every crawled sub-page Content object is connected to its parent Source object in `object_relations`:
* **Source ID** ➔ `produces_content` ➔ **Content ID**
* **Verification**: Checked and confirmed that all 132 newly created Content nodes possess a valid back-reference relation pointing to their source domain.
