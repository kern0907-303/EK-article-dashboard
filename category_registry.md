# Category Registry

The Category Registry defines the high-level semantic taxonomies used to organize discovered information sources.

## Database Schema (Properties)

Each Category object is represented as a record in the `objects` table of type `Category` containing:

* **`id`** (`category_id`): Unique slug identifier (e.g. `womens_growth`, `numerology`, `ai`).
* **`type`**: `"Category"`
* **`lifecycle`**: `"Active"`
* **`properties`**:
  * `name`: Display name.
  * `description`: Overview description of what the category entails.
  * `keywords`: Array of search query keywords (JSON list of strings).
  * `target_audience`: The demographic profile targeted by this category.
  * `region`: Target country or region (e.g., Global, US, TW).
  * `language`: Primary language (e.g., en, zh-TW).
  * `priority`: Scheduling priority (High, Medium, Low).
  * `status`: Active or Deprecated state.
  * `created_at` / `updated_at`: Timestamp logs.

---

## Registered Categories (25 total)

The initial version registers the following 25 categories:

1. **Women's Growth**
2. **Personal Development**
3. **Leadership**
4. **Business**
5. **Marketing**
6. **AI**
7. **Psychology**
8. **Health**
9. **Wellness**
10. **Numerology**
11. **Spiritual**
12. **Enterprise**
13. **Coaching**
14. **Education**
15. **Course Creator**
16. **Publisher**
17. **Media**
18. **Community**
19. **Podcast**
20. **YouTube Creator**
21. **Finance**
22. **Investment**
23. **Productivity**
24. **Decision Making**
25. **Organization Development**
