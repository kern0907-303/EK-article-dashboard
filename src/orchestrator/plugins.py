import os
import json
from ..database import save_object, get_objects_by_type

class BasePlugin:
    def __init__(self, config=None):
        self.config = config or {}

# --- Monitor / Scraper Plugins ---

import requests
import xml.etree.ElementTree as ET

class RSSScraperPlugin(BasePlugin):
    def scrape(self, url: str) -> str:
        """
        Fetches a real RSS feed URL, parses the XML, and returns a clean Markdown content summary.
        Falls back to a simulated feed if the URL is a mock or if the request fails.
        """
        if not url or "example.com" in url or "mock" in url:
            return f"# RSS Feed (Simulated): {url}\n\n## Competitor Article Title\nBody describing Russell Brunson secrets funnel scaling."
        
        try:
            headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code != 200:
                return f"# RSS Feed Error: HTTP {res.status_code} for {url}\n\nFallback simulated content:\n## Competitor Article Title\nBody describing Russell Brunson secrets funnel scaling."
            
            root = ET.fromstring(res.content)
            channel = root.find("channel")
            items = []
            
            if channel is not None:
                # RSS Format
                for item in channel.findall("item")[:5]: # Limit to top 5 items
                    title = item.findtext("title", "Untitled")
                    link = item.findtext("link", "")
                    desc = item.findtext("description", "")
                    # Clean simple HTML from description if any
                    desc_clean = ET.Element("div")
                    try:
                        desc_clean = ET.fromstring(f"<div>{desc}</div>")
                        desc = "".join(desc_clean.itertext())
                    except:
                        import re
                        desc = re.sub(r'<[^>]+>', '', desc)
                    items.append(f"### {title}\nLink: {link}\nDescription: {desc.strip()[:300]}\n")
            else:
                # Atom Format
                entries = root.findall("{http://www.w3.org/2005/Atom}entry")[:5]
                for entry in entries:
                    title = entry.findtext("{http://www.w3.org/2005/Atom}title", "Untitled")
                    link_node = entry.find("{http://www.w3.org/2005/Atom}link")
                    link = link_node.get("href", "") if link_node is not None else ""
                    desc = entry.findtext("{http://www.w3.org/2005/Atom}summary", "") or entry.findtext("{http://www.w3.org/2005/Atom}content", "")
                    import re
                    desc = re.sub(r'<[^>]+>', '', desc)
                    items.append(f"### {title}\nLink: {link}\nDescription: {desc.strip()[:300]}\n")
                    
            if not items:
                return f"# RSS Feed: {url}\n\nNo items found in feed."
                
            return f"# RSS Feed: {url}\n\n" + "\n".join(items)
        except Exception as e:
            return f"# RSS Feed Error: {str(e)} for {url}\n\nFallback simulated content:\n## Competitor Article Title\nBody describing Russell Brunson secrets funnel scaling."

class FirecrawlScraperPlugin(BasePlugin):
    def scrape(self, url: str) -> str:
        """
        Crawls a webpage URL using Firecrawl API to extract clean Markdown.
        Falls back to tag-stripped HTML scraping if the Firecrawl API key is missing.
        """
        from ..agents.utils import get_api_key
        api_key = get_api_key("FIRECRAWL_API_KEY")
        
        if not api_key or "example.com" in url or "mock" in url:
            # Fallback mock scraping
            return f"# Web Crawl (Simulated): {url}\n\nCompetitor sales page details on high ticket ABL training. Focus on state-shifting, getting into high vibration, and selling high-ticket offers using direct response copy."
            
        try:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "url": url,
                "formats": ["markdown"]
            }
            res = requests.post("https://api.firecrawl.dev/v1/scrape", headers=headers, json=payload, timeout=20)
            if res.status_code == 200:
                data = res.json()
                if data.get("success") and "markdown" in data.get("data", {}):
                    return data["data"]["markdown"]
                elif "markdown" in data:
                    return data["markdown"]
                    
            # API call failed, fall back to simple request + HTML stripping
            html_res = requests.get(url, timeout=10)
            import re
            text = html_res.text
            text = re.sub(r'<script.*?</script>', '', text, flags=re.DOTALL)
            text = re.sub(r'<style.*?</style>', '', text, flags=re.DOTALL)
            text = re.sub(r'<[^>]+>', ' ', text)
            clean_text = "\n".join([line.strip() for line in text.splitlines() if line.strip()][:30])
            return f"# Web Crawl Fallback: {url}\n\n{clean_text}"
        except Exception as e:
            return f"# Web Crawl Error: {str(e)} for {url}\n\nCompetitor sales page details on high ticket ABL training."

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
