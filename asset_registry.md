# Asset Registry

The **Asset Registry** provides a database-backed system for registering and tracking all published and scheduled content assets across the brand ecosystem. It acts as the central memory of the system's content volume, frequency, and historical performance.

---

## 1. Asset Schema

Each asset entry in the database is modeled as a standard SQLite-backed object with the following properties:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `asset_id` | `TEXT (PK)` | Unique identifier for the asset. |
| `brand` | `TEXT` | Brand ID (e.g. `test-brand` / `ABL` / `NAS` / `I8`). |
| `topic` | `TEXT` | The exact core topic of the content. |
| `keywords` | `JSON (List)` | List of associated key semantic tags. |
| `campaign` | `TEXT` | Associated active campaign theme name. |
| `product` | `TEXT` | Focus product associated with the asset. |
| `content_type` | `TEXT` | The format of the content (see below). |
| `publish_date` | `TEXT` | Publish date formatted as `YYYY-MM-DD`. |
| `status` | `TEXT` | State of the asset (e.g., `Draft`, `Scheduled`, `Published`). |
| `performance` | `JSON (Dict)`| Custom performance metrics (likes, shares, views, etc.). |
| `ctr` | `REAL` | Click-Through Rate (%). |
| `conversion` | `REAL` | Conversion rate (%). |
| `reuse_score` | `REAL` | System score assessing potential for format reuse. |
| `last_updated` | `TEXT` | Timestamp of the last modification (`YYYY-MM-DD HH:MM:SS`). |

---

## 2. Supported Content Types

The system registers assets across 12 primary format categories:
1. `Facebook`
2. `Reels`
3. `YouTube`
4. `Podcast`
5. `Blog`
6. `Lecture`
7. `Workshop`
8. `Quiz`
9. `Landing Page`
10. `Email`
11. `Ads`
12. `Book`

---

## 3. Database Operations

Programmatic interaction with the registry is handled through `src/orchestrator/models.py#Asset` class:

* **Creation**: `Asset.create(asset_id, brand, topic, keywords, campaign, product, content_type, ...)`
* **Retrieval**: `Asset.get(asset_id)`
* **Listing**: `Asset.get_all()`

### Example: Programmatic Registration
```python
from src.orchestrator.models import Asset

Asset.create(
    asset_id="asset_fb_101",
    brand="test-brand",
    topic="35~55 女性如何提升承接力以釋放壓力",
    keywords=["狀態", "承接力", "壓力"],
    campaign="打破消耗：中年女性的狀態調整與穩定方案",
    product="人生承接力",
    content_type="Facebook",
    publish_date="2026-06-26",
    status="Published",
    ctr=3.4,
    conversion=1.2,
    reuse_score=85.0
)
```
