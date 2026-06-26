import unittest
import os
import sys
import uuid

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from src.database import init_db
from src.orchestrator.plugins import PluginManager
from src.orchestrator.graph import KnowledgeGraph
from src.orchestrator.scoring import ScoringEngine
from src.orchestrator.models import Brand

class TestPhase2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_plugin_manager(self):
        mgr = PluginManager()
        
        # Test scraper plugins
        rss = mgr.get_plugin_instance("rss_scraper")
        self.assertIsNotNone(rss)
        text = rss.scrape("https://example.com/rss")
        self.assertIn("Feed", text)
        
        # Test trends plugins
        gt = mgr.get_plugin_instance("google_trends")
        self.assertIsNotNone(gt)
        trends = gt.get_trends()
        self.assertEqual(len(trends), 2)

    def test_knowledge_graph(self):
        brand_id = f"brand_{uuid.uuid4()}"
        pain_id = f"pain_{uuid.uuid4()}"
        
        # Create nodes
        n1 = KnowledgeGraph.create_node(brand_id, "brand", {"name": "Graph Brand"})
        n2 = KnowledgeGraph.create_node(pain_id, "pain_point", {"description": "Exhausted"})
        
        self.assertTrue(n1)
        self.assertTrue(n2)
        
        # Link nodes via edge relation
        edge = KnowledgeGraph.create_edge(brand_id, pain_id, "solves_pain", {"confidence": 0.95})
        self.assertTrue(edge)
        
        # Query relations
        connected = KnowledgeGraph.query_connected_nodes(brand_id, "solves_pain")
        self.assertEqual(len(connected), 1)
        self.assertEqual(connected[0]["id"], pain_id)
        self.assertEqual(connected[0]["properties"]["description"], "Exhausted")

    def test_scoring_engine(self):
        brand_id = f"brand_{uuid.uuid4()}"
        topic_id = f"topic_{uuid.uuid4()}"
        
        # Create brand guidelines and custom weights
        Brand.create(
            brand_id=brand_id,
            name="Scoring Brand",
            positioning="A", target_audience="B", products=[], tone_of_voice="C",
            forbidden_words=[], prompts={}, methodology="D",
            score_weights={"opportunity": 0.4, "trend": 0.2, "roi": 0.4}
        )
        
        engine = ScoringEngine()
        metrics = {
            "market_heat": 8.5,
            "search_volume": 6000,
            "competitor_volume": 3,
            "brand_fit": 9.0
        }
        
        final_score = engine.calculate_topic_score(brand_id, topic_id, metrics)
        
        # Expected scoring calculations:
        # opp = (8.5 * 0.6) + (6000/1000) = 5.1 + 6 = 11.1
        # gap = max(0, 10 - 3) * 10 = 70.0
        # roi = 9.0 * 11.5 = 103.5
        # weighted = (11.1 * 0.4) + (70.0 * 0.2) + (103.5 * 0.4) = 4.44 + 14.0 + 41.4 = 59.84
        self.assertAlmostEqual(final_score, 59.84, places=1)
        
if __name__ == "__main__":
    unittest.main()
