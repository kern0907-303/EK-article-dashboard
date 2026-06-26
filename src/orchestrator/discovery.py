import uuid
import re

class SourceDiscoveryEngine:
    def __init__(self):
        # Pre-registered plugin metadata representing future integrations
        self.available_plugins = [
            {"id": "google_search", "name": "Google Search Plugin", "status": "registered"},
            {"id": "google_trends", "name": "Google Trends Plugin", "status": "registered"},
            {"id": "youtube_api", "name": "YouTube API Plugin", "status": "registered"},
            {"id": "reddit_api", "name": "Reddit API Plugin", "status": "registered"},
            {"id": "firecrawl", "name": "Firecrawl Scraper Plugin", "status": "registered"},
            {"id": "apify", "name": "Apify Crawler Plugin", "status": "registered"},
            {"id": "rss", "name": "RSS Feed Ingestor Plugin", "status": "registered"},
            {"id": "serpapi", "name": "SerpAPI Plugin", "status": "registered"},
            {"id": "similarweb", "name": "Similarweb API Plugin", "status": "registered"},
            {"id": "ahrefs", "name": "Ahrefs SEO API Plugin", "status": "registered"},
            {"id": "semrush", "name": "Semrush Competitor API Plugin", "status": "registered"},
            {"id": "buzzsumo", "name": "BuzzSumo Trend Plugin", "status": "registered"}
        ]

    def get_plugin_interfaces(self) -> list:
        """Returns the list of future integration plugins."""
        return self.available_plugins

    def discover_candidates(self, category_id: str) -> list:
        """
        Mock discovers at least 10 candidate sources based on a Category ID.
        Includes all source types and satisfies Scenarios 1, 3, and 4.
        Ensures all mock sources are clearly flagged with Source Reality Check tags.
        """
        candidates = []
        clean_cat = category_id.lower().replace("'", "").replace(" ", "_")
        
        # Scenario 1 & 3: Women's Growth
        if "womens_growth" in clean_cat or "women" in clean_cat:
            mock_data = [
                {
                    "name": "Sheryl Sandberg Foundation", 
                    "type": "Website", 
                    "url": "https://leanin.org", 
                    "frequency": "daily", 
                    "traffic": 85.0,
                    "relevance": 90.0,
                    "authority": 88.0
                },
                {
                    "name": "Marie Forleo Blog", 
                    "type": "Blog", 
                    "url": "https://marieforleo.com/blog", 
                    "frequency": "weekly", 
                    "traffic": 90.0,
                    "relevance": 85.0,
                    "authority": 87.0
                },
                {
                    "name": "Oprah Winfrey Network Channel", 
                    "type": "YouTube", 
                    "url": "https://youtube.com/own", 
                    "youtube_channel": "Oprah Winfrey Network",
                    "frequency": "daily", 
                    "traffic": 98.0,
                    "relevance": 92.0,
                    "authority": 96.0
                },
                {
                    "name": "Gretchen Rubin Podcast", 
                    "type": "Podcast", 
                    "url": "https://gretchenrubin.com/podcasts", 
                    "podcast": "Happier with Gretchen Rubin",
                    "frequency": "weekly", 
                    "traffic": 78.0,
                    "relevance": 80.0,
                    "authority": 82.0
                },
                {
                    "name": "Female Quotient Threads Feed", 
                    "type": "Threads", 
                    "url": "https://threads.net/@femalequotient", 
                    "threads": "@femalequotient",
                    "frequency": "daily", 
                    "traffic": 72.0,
                    "relevance": 75.0,
                    "authority": 70.0
                },
                {
                    "name": "The Cut Women In Business", 
                    "type": "News", 
                    "url": "https://thecut.com", 
                    "frequency": "daily", 
                    "traffic": 80.0,
                    "relevance": 70.0,
                    "authority": 85.0
                },
                {
                    "name": "The Skimm Daily Newsletter", 
                    "type": "Email Newsletter", 
                    "url": "https://theskimm.com", 
                    "newsletter": "theSkimm Daily",
                    "frequency": "daily", 
                    "traffic": 88.0,
                    "relevance": 65.0,
                    "authority": 80.0
                },
                {
                    "name": "Tony Robbins Women Leadership Summit", 
                    "type": "Sales Page", 
                    "url": "https://tonyrobbins.com/women-leadership", 
                    "frequency": "daily", 
                    "traffic": 95.0,
                    "relevance": 95.0,
                    "authority": 95.0
                },
                {
                    "name": "Women In Business Annual Event Page", 
                    "type": "Event Page", 
                    "url": "https://wibevent.com/2026", 
                    "frequency": "monthly", 
                    "traffic": 40.0,
                    "relevance": 60.0,
                    "authority": 50.0
                },
                {
                    "name": "Teachable Women Mindset Coaching Course", 
                    "type": "Course Platform", 
                    "url": "https://teachable.com/women-mindset", 
                    "frequency": "monthly", 
                    "traffic": 30.0,
                    "relevance": 55.0,
                    "authority": 45.0
                },
                {
                    "name": "Low Update Inactive Source", 
                    "type": "Website", 
                    "url": "https://inactive-women-growth.com", 
                    "frequency": "monthly", 
                    "traffic": 5.0,
                    "relevance": 10.0,
                    "authority": 10.0
                }
            ]
        else:
            # Fallback general discovery list containing 10 items of different types
            mock_data = [
                {"name": "TechCrunch AI", "type": "News", "url": "https://techcrunch.com/category/ai", "frequency": "daily", "traffic": 92.0, "relevance": 60.0, "authority": 90.0},
                {"name": "Lilian Weng Blog", "type": "Blog", "url": "https://lilianweng.github.io", "frequency": "monthly", "traffic": 75.0, "relevance": 80.0, "authority": 85.0},
                {"name": "Lex Fridman Podcast", "type": "Podcast", "url": "https://youtube.com/lexfridman", "frequency": "weekly", "traffic": 96.0, "relevance": 70.0, "authority": 90.0},
                {"name": "Andrej Karpathy YouTube", "type": "YouTube", "url": "https://youtube.com/karpathy", "frequency": "monthly", "traffic": 88.0, "relevance": 85.0, "authority": 90.0},
                {"name": "HackerNews", "type": "Forum", "url": "https://news.ycombinator.com", "frequency": "daily", "traffic": 97.0, "relevance": 50.0, "authority": 88.0},
                {"name": "Reddit Machine Learning", "type": "Reddit", "url": "https://reddit.com/r/MachineLearning", "frequency": "daily", "traffic": 91.0, "relevance": 45.0, "authority": 80.0},
                {"name": "Local Low Quality", "type": "Website", "url": "https://lowqualityblog.com", "frequency": "monthly", "traffic": 2.0, "relevance": 15.0, "authority": 20.0},
                {"name": "Local Medium Quality", "type": "Website", "url": "https://medqualityblog.com", "frequency": "weekly", "traffic": 40.0, "relevance": 50.0, "authority": 50.0},
                {"name": "Mock Candidate 9", "type": "Website", "url": "https://mock9.com", "frequency": "weekly", "traffic": 50.0, "relevance": 50.0, "authority": 50.0},
                {"name": "Mock Candidate 10", "type": "Website", "url": "https://mock10.com", "frequency": "daily", "traffic": 55.0, "relevance": 55.0, "authority": 55.0}
            ]
            
        for item in mock_data:
            source_id = f"source_cand_{uuid.uuid4().hex[:8]}"
            candidates.append({
                "source_id": source_id,
                "name": item["name"],
                "category_id": category_id,
                "source_type": item["type"],
                "url": item["url"],
                "rss_url": item.get("rss_url", ""),
                "youtube_channel": item.get("youtube_channel", ""),
                "facebook_page": item.get("facebook_page", ""),
                "instagram": item.get("instagram", ""),
                "threads": item.get("threads", ""),
                "podcast": item.get("podcast", ""),
                "newsletter": item.get("newsletter", ""),
                "update_frequency": item["frequency"],
                "traffic_score": item["traffic"],
                "relevance_score": item["relevance"],
                "authority_score": item["authority"],
                "country": "US",
                "language": "en",
                # Source Reality Check fields
                "is_mock": True,
                "source_confidence": "simulated",
                "url_status": "unverified"
            })
            
        return candidates
