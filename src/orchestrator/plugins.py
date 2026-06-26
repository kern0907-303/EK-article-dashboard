import os
import json
from ..database import save_object, get_objects_by_type

class BasePlugin:
    def __init__(self, config=None):
        self.config = config or {}

# --- Monitor / Scraper Plugins ---

class RSSScraperPlugin(BasePlugin):
    def scrape(self, url: str) -> str:
        # Simulate RSS fetching
        return f"# RSS Feed: {url}\n\n## Competitor Article Title\nBody describing Russell Brunson secrets funnel scaling."

class FirecrawlScraperPlugin(BasePlugin):
    def scrape(self, url: str) -> str:
        # Simulate web crawling
        return f"# Web Crawl: {url}\n\nCompetitor sales page details on high ticket ABL training."

# --- Trend Plugins ---

class GoogleTrendsPlugin(BasePlugin):
    def get_trends(self) -> list:
        return [
            {"topic": "ABL 能量調頻", "volume": 12000, "source": "Google Trends"},
            {"topic": "高價諮詢漏斗", "volume": 8500, "source": "Google Trends"}
        ]

class RedditTrendPlugin(BasePlugin):
    def get_trends(self) -> list:
        return [
            {"topic": "價值階梯設計", "volume": 5400, "source": "Reddit"},
            {"topic": "Dream 100 實戰", "volume": 3200, "source": "Reddit"}
        ]

# --- Scoring Plugins ---

class OpportunityScorePlugin(BasePlugin):
    def calculate(self, properties: dict) -> float:
        # Opportunity = (market heat * 0.6) + search_volume / 1000
        heat = properties.get("market_heat", 5.0)
        vol = properties.get("search_volume", 5000)
        return round((heat * 0.6) + (vol / 1000), 2)

class GapScorePlugin(BasePlugin):
    def calculate(self, properties: dict) -> float:
        # Niche gap is based on competitor count (lower competitor density means higher score)
        comps = properties.get("competitor_volume", 10)
        return round(max(0.0, 10.0 - comps) * 10, 2)

class ROIScorePlugin(BasePlugin):
    def calculate(self, properties: dict) -> float:
        # ROI = brand fit * product margin
        fit = properties.get("brand_fit", 8.0)
        return round(fit * 11.5, 2)

# --- Plugin Registry Manager ---

class PluginManager:
    def __init__(self):
        self.registry = {}
        # Register built-in plugins
        self.register_plugin("rss_scraper", "monitor", RSSScraperPlugin)
        self.register_plugin("firecrawl_scraper", "monitor", FirecrawlScraperPlugin)
        self.register_plugin("google_trends", "trend", GoogleTrendsPlugin)
        self.register_plugin("reddit_trends", "trend", RedditTrendPlugin)
        self.register_plugin("opportunity_scorer", "scoring", OpportunityScorePlugin)
        self.register_plugin("gap_scorer", "scoring", GapScorePlugin)
        self.register_plugin("roi_scorer", "scoring", ROIScorePlugin)
        
        self.sync_plugins_to_db()

    def register_plugin(self, plugin_id: str, plugin_type: str, class_ref):
        self.registry[plugin_id] = {
            "type": plugin_type,
            "class": class_ref
        }

    def sync_plugins_to_db(self):
        """Saves registered plugin profiles as Plugin objects in the SQLite database."""
        for p_id, p_info in self.registry.items():
            save_object(
                obj_id=p_id,
                obj_type="Plugin",
                properties={"type": p_info["type"], "class_name": p_info["class"].__name__},
                lifecycle="Active",
                owner="system"
            )

    def get_plugin_instance(self, plugin_id: str, config=None):
        if plugin_id in self.registry:
            return self.registry[plugin_id]["class"](config)
        return None

    def get_plugins_by_type(self, plugin_type: str) -> list:
        return [p_id for p_id, p_info in self.registry.items() if p_info["type"] == plugin_type]
