# Source Acquisition Policy

This policy defines the rules, criteria, and boundaries for collecting, verifying, and utilizing competitor and market source intelligence in the Brand Intelligence OS.

---

## 1. Source Priority Rules
Sources are classified into four tiers to prioritize crawl bandwidth and decision weights:
* **Tier 1 (High Authority & Relevance)**: Market leaders, official documentation repositories, and core verified competitor blogs. Crawled daily. High decision weight.
* **Tier 2 (Niche Experts & Influencers)**: Active individual creator blogs, authority podcasts, and active newsletter feeds. Crawled bi-weekly. Medium decision weight.
* **Tier 3 (General Industry Media)**: General marketing websites, public community forums, and standard news channels. Crawled weekly. Low decision weight.
* **Tier 4 (Unverified / Candidates)**: Newly discovered feeds and raw URL submissions. Awaiting verification checks. Not used for active decision generation.

---

## 2. Allowed Source Types
The system is authorized to ingest intelligence only from these specified formats:
* **Website / Blog**: Standard informational domains.
* **RSS**: Structured syndication feeds.
* **YouTube**: Public video channels.
* **Podcast**: Audio feeds and transcript portals.
* **Sales Page / Event Page**: Public product offers and campaign launches.
* **Lead Magnet / Newsletter**: Public opt-in flows and email dispatches.
* **Course Page / Community**: Public-facing course descriptions and public forum indices.

---

## 3. Source Quality Criteria
Every candidate source must satisfy the following eight parameters during auditing:
1. **Authority**: Industry standing and domain reputation.
2. **Traffic**: Approximate visitor engagement and audience activity.
3. **Update Frequency**: Published content intervals (minimum monthly updates).
4. **Commercial Value**: Degree of monetization or high-ticket sales alignment.
5. **Audience Match**: Aligns with target customer demographics (35~55 females, entrepreneurs, CEOs).
6. **Brand Relevance**: Aligns with core brand topics (consciousness, state alignment, life rhythms, business management).
7. **Content Quality**: Rich, original text rather than content aggregation.
8. **Traceability**: Transparent authorship and verifiable source URLs.

---

## 4. Forbidden Sources
The following sources are strictly banned from inclusion in the database:
* **Pirated content** sites.
* **Content farms** that aggregate or re-spin low-value copy.
* **Untraceable summaries** with missing original URLs.
* **Private communities** or behind-the-wall member feeds.
* **Login-only content** requiring authentication.
* **Paid course full content** (only public sales copies are allowed).
* **Personal data** or private, identifiable client information.
* **Low-quality AI generated** sites lacking original human editorial oversight.

---

## 5. Content Usage Rules

### Allowed Uses:
* **Summarization**: Compiling high-level themes.
* **Pattern extraction**: Dissecting headlines, hooks, and FAQ structures.
* **CTA & Offer analysis**: Cataloging competitor offers and call-to-actions.
* **Pain point extraction**: Isolating target audience worries.
* **Trend analysis**: Plotting industry topic shifts.

### Forbidden Uses:
* **Copying original text** verbatim into final publications.
* **Rewriting with high similarity** that violates copyright/fair use.
* **Copying competitor sales pages** directly.
* **Storing paid content** locally.
* **Treating unverified data** as verified intelligence in reports.

---

## 6. Data Quality Levels
Data assets in the database are ranked on a 6-tier quality scale:
* **Level 0**: Mock or seeded placeholder data.
* **Level 1**: URL verified for HTTP connectivity and reachability.
* **Level 2**: Real page content fetched, cleaned, and stored in the database.
* **Level 3**: Reusable patterns extracted from real Level 2 content.
* **Level 4**: Reusable business formulas derived from multiple patterns.
* **Level 5**: Evidence backed by verified traffic/conversion performance metrics.

---

## 7. Decision Rule
* **Priority**: The daily recommendation system must base its decisions and recommendations exclusively on **Level 2** data or above.
* **Testing Restriction**: Level 0 data is strictly restricted to testing and developer pipeline checks.
* **Influence Filter**: Unverified sources (verified = false or Tier 4) are completely filtered out and **cannot** influence the final recommended topics or campaign suggestions.

---

## 8. Region and Language Rules
1. **English Market First**: Primary benchmark for global business strategies and digital products.
2. **Traditional Chinese Market Second**: Primary benchmark for Erick's personal consulting, ABL state adjustment, and NAS numerology.
3. **Simplified Chinese Market Third**: Secondary benchmark for corporate training and advisory niches.
