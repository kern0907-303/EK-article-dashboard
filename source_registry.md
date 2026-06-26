# Source Registry

The Source Registry is the core repository of intelligence feeds in the Brand Intelligence OS.

## Source Registry Schema

Each Source object is saved in the database under type `Source` with the following properties:

| Property | Type | Description |
| :--- | :--- | :--- |
| `source_id` | String | Unique ID prefix `source_cand_` |
| `name` | String | Display name of the source |
| `category_id` | String | FK to Category ID |
| `brand_id` | String | Associated Brand Metadata ID |
| `owner` | String | Owner identifier (e.g. system, test-brand) |
| `source_type` | String | Platform type classification |
| `country` | String | Origin country |
| `language` | String | Feeds language |
| `url` | String | Core web URL |
| `rss_url` | String | RSS Feed endpoint |
| `youtube_channel` | String | YouTube profile handle |
| `facebook_page` | String | Facebook page endpoint |
| `instagram` | String | Instagram user handle |
| `threads` | String | Threads account handle |
| `podcast` | String | Podcast channel handle |
| `newsletter` | String | Newsletter name |
| `update_frequency` | String | Refresh interval: daily, weekly, monthly |
| `authority_score` | Float | Authority rating (0 - 100) |
| `traffic_score` | Float | Traffic volume rating (0 - 100) |
| `seo_score` | Float | Search optimization score (0 - 100) |
| `engagement_score` | Float | Community activity rating (0 - 100) |
| `conversion_score` | Float | Commercial value index (0 - 100) |
| `quality_score` | Float | Editorial quality index (0 - 100) |
| `overall_source_score` | Float | Weighted final score |
| `tier` | String | Classification (Tier 1 to 4) |
| `status` | String | Lifecycle state: Candidate, Active |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last edit timestamp |

---

## 25 Supported Source Types

The Source Registry supports the following platforms:

1. Website
2. Blog
3. RSS
4. Facebook
5. Instagram
6. Threads
7. YouTube
8. Podcast
9. News
10. Reddit
11. LinkedIn
12. X / Twitter
13. TikTok
14. Email Newsletter
15. Sales Page
16. Landing Page
17. Event Page
18. Course Platform
19. Book
20. PDF
21. Google Drive
22. Notion
23. Community
24. Forum
25. Research Paper
