import unittest
import os
import sys
import json
import uuid

# Include src in path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from src.database import init_db, save_object, get_object, add_relation, get_relations
from src.orchestrator.classifier import TaskClassifier
from src.orchestrator.router import ModelRouter
from src.orchestrator.registry import AgentRegistry
from src.orchestrator.models import Brand, Source

class TestOrchestratorCore(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Reset DB for tests
        init_db()

    def test_database_crud(self):
        obj_id = f"test_obj_{uuid.uuid4()}"
        properties = {"key": "value", "number": 123}
        
        # 1. Test Save
        saved = save_object(obj_id, "TestType", properties, "Active", "system")
        self.assertTrue(saved)
        
        # 2. Test Get
        obj = get_object(obj_id)
        self.assertIsNotNone(obj)
        self.assertEqual(obj["type"], "TestType")
        self.assertEqual(obj["properties"]["key"], "value")
        self.assertEqual(obj["properties"]["number"], 123)
        self.assertEqual(obj["lifecycle"], "Active")
        
        # 3. Test Relations
        target_id = f"test_target_{uuid.uuid4()}"
        save_object(target_id, "TestTarget", {"name": "target"}, "Active", "system")
        
        related = add_relation(obj_id, target_id, "links_to", {"meta": "data"})
        self.assertTrue(related)
        
        rels = get_relations(obj_id)
        self.assertEqual(len(rels), 1)
        self.assertEqual(rels[0]["target_id"], target_id)
        self.assertEqual(rels[0]["relation_type"], "links_to")
        self.assertEqual(rels[0]["properties"]["meta"], "data")

    def test_agent_registry(self):
        registry = AgentRegistry()
        agents = registry.get_all_agents()
        self.assertGreater(len(agents), 0)
        
        # Gemini should be present
        gemini = registry.get_agent("gemini")
        self.assertIsNotNone(gemini)
        self.assertIn("scraping", gemini["properties"]["capabilities"])
        
        # Search for copywriting capability
        copy_agents = registry.find_agents_for_capability("copywriting")
        self.assertGreater(len(copy_agents), 0)
        self.assertTrue(any(a["id"] == "chatgpt" for a in copy_agents))

    def test_task_classifier(self):
        classifier = TaskClassifier()
        
        # Check competitive analysis classification
        res1 = classifier.classify("幫我分析競品銷售頁並轉譯FB貼文")
        self.assertEqual(res1["task_type"], "Competitive Analysis & Marketing Asset Generation")
        self.assertIn("scraping", res1["required_capabilities"])
        self.assertIn("copywriting", res1["required_capabilities"])
        
        # Check coding classification
        res2 = classifier.classify("請用 Python 檢查 capabilities.json 並修復 debug 錯誤")
        self.assertEqual(res2["task_type"], "Software Engineering & Testing")
        self.assertIn("syntax_check", res2["required_capabilities"])
        self.assertNotIn("copywriting", res2["required_capabilities"])

    def test_model_router(self):
        router = ModelRouter()
        
        # Test routing for copywriting + analysis
        caps = ["deep_analysis", "brand_translation", "copywriting"]
        route_info = router.route(caps)
        self.assertIn("claude", route_info["route_sequence"])
        self.assertIn("chatgpt", route_info["route_sequence"])
        self.assertNotIn("gemini", route_info["route_sequence"])
        
        # Test routing for coding
        caps_code = ["syntax_check", "unit_test_run", "code_patching"]
        route_info_code = router.route(caps_code)
        self.assertEqual(route_info_code["route_sequence"], ["codex"])

    def test_brand_and_source_models(self):
        brand_id = f"brand_{uuid.uuid4()}"
        # 1. Create brand
        created = Brand.create(
            brand_id=brand_id,
            name="Test Brand Model",
            positioning="Test Positioning",
            target_audience="Test Audience",
            products=[{"name": "p1", "price": 100}],
            tone_of_voice="Test Tone",
            forbidden_words=["worst"],
            prompts={"system": "write code"},
            methodology="Method A",
            score_weights={"opportunity": 0.5}
        )
        self.assertTrue(created)
        
        brand_obj = Brand.get(brand_id)
        self.assertEqual(brand_obj["properties"]["name"], "Test Brand Model")
        self.assertEqual(brand_obj["properties"]["score_weights"]["opportunity"], 0.5)
        
        # 2. Create source
        source_id = f"source_{uuid.uuid4()}"
        source_created = Source.create(
            source_id=source_id,
            brand_id=brand_id,
            source_type="rss",
            plugin_name="rss_crawler",
            source_url="https://test.com/feed",
            config={"interval": 60}
        )
        self.assertTrue(source_created)
        
        source_obj = Source.get(source_id)
        self.assertEqual(source_obj["properties"]["source_url"], "https://test.com/feed")
        
        # Verify edge relation
        rels = get_relations(brand_id)
        self.assertTrue(any(r["target_id"] == source_id and r["relation_type"] == "owns" for r in rels))

if __name__ == "__main__":
    unittest.main()
