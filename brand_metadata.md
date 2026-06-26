# Brand Metadata Documentation

Under the Source-Centric architecture, **Brand** is no longer the central operational database anchor. It is downgraded to **Brand Metadata**, functioning as a grouping catalog mapping associated `source_ids`.

## Brand Metadata Schema

Each Brand object is stored under type `Brand` in the SQLite database containing:

* **`brand_id`** (`brand_id`): Unique ID string (e.g. `test-brand`).
* **`type`**: `"Brand"`
* **`lifecycle`** / **`status`**: `"Active"`
* **`properties`**:
  * `name`: Brand profile name.
  * `positioning`: Marketing value proposition (e.g., ABL adjustments).
  * `audience`: Targeted demographic profile description.
  * `products`: JSON list of core offers/products sold by the brand, containing `name` and `price`.
  * `tone`: Stylistic and editorial tone guidelines.
  * `region`: Operating market.
  * `language`: Primary language.
  * `source_ids`: JSON array listing strings of all registered Sources owned by or associated with this brand.

---

## Example Association Flow

A Brand like `Tony Robbins` is represented as metadata aggregating his diverse platform sources:

```
Tony Robbins Brand Metadata
├── source_cand_tr1 (Official Website)
├── source_cand_tr2 (Blog)
├── source_cand_tr3 (YouTube Channel)
├── source_cand_tr4 (Podcast Feed)
├── source_cand_tr5 (Facebook Page)
├── source_cand_tr6 (Instagram Profile)
├── source_cand_tr7 (Sales Page)
├── source_cand_tr8 (Event Page)
└── source_cand_tr9 (Newsletter Feed)
```
