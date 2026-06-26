import unittest
import os
import sys
import uuid

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from src.database import init_db, get_object
from src.orchestrator.models import Brand
from src.orchestrator.decision import DecisionEngine
from src.orchestrator.factory import ContentFactory
from src.orchestrator.publish import PublishCenter
from src.orchestrator.learning import LearningEngine

class TestPhase3(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_decision_engine(self):
        brand_id = f"brand_{uuid.uuid4()}"
        engine = DecisionEngine()
        
        # Test generation with fallback
        decisions = engine.generate_recommendations(brand_id)
        self.assertIn("today_top_5", decisions)
        self.assertEqual(len(decisions["today_top_5"]), 5)
        self.assertEqual(decisions["today_top_5"][0]["priority"], "P0")
        self.assertIn("monthly_campaign", decisions)

    def test_content_factory(self):
        brand_id = f"brand_{uuid.uuid4()}"
        Brand.create(
            brand_id=brand_id,
            name="Factory Brand",
            positioning="A", target_audience="B", products=[], tone_of_voice="C",
            forbidden_words=[], prompts={}, methodology="D",
            score_weights={"opportunity": 0.5}
        )
        
        factory = ContentFactory()
        content_id = factory.generate_assets(brand_id, "ABL 能量調頻術", Brand.get(brand_id)["properties"])
        
        self.assertIsNotNone(content_id)
        content_obj = get_object(content_id)
        self.assertEqual(content_obj["type"], "Content")
        self.assertEqual(content_obj["lifecycle"], "Draft")
        self.assertEqual(content_obj["properties"]["topic"], "ABL 能量調頻術")

    def test_publish_center(self):
        brand_id = f"brand_{uuid.uuid4()}"
        Brand.create(
            brand_id=brand_id,
            name="Publish Brand",
            positioning="A", target_audience="B", products=[], tone_of_voice="C",
            forbidden_words=[], prompts={}, methodology="D",
            score_weights={"opportunity": 0.5}
        )
        factory = ContentFactory()
        content_id = factory.generate_assets(brand_id, "價值階梯設計", Brand.get(brand_id)["properties"])
        
        # 1. Submit for review (Pending)
        submitted = PublishCenter.submit_for_review(content_id)
        self.assertTrue(submitted)
        self.assertEqual(get_object(content_id)["lifecycle"], "Pending")
        
        # 2. Approve asset (Approved)
        approved = PublishCenter.approve_asset(content_id)
        self.assertTrue(approved)
        self.assertEqual(get_object(content_id)["lifecycle"], "Approved")

    def test_learning_engine(self):
        brand_id = f"brand_{uuid.uuid4()}"
        Brand.create(
            brand_id=brand_id,
            name="Learning Brand",
            positioning="A", target_audience="B", products=[], tone_of_voice="C",
            forbidden_words=[], prompts={}, methodology="D",
            score_weights={"opportunity": 0.3, "roi": 0.4}
        )
        
        engine = LearningEngine()
        result = engine.process_analytics_feedback(brand_id, "content_xxx", ctr=4.5, conversions=10)
        
        self.assertTrue(result["adjusted"])
        # Opportunity weight adjusted from 0.3 to 0.35
        self.assertEqual(result["new_weights"]["opportunity"], 0.35)
        # Verify SQLite updated
        updated_brand = Brand.get(brand_id)
        self.assertEqual(updated_brand["properties"]["score_weights"]["opportunity"], 0.35)

if __name__ == "__main__":
    unittest.main()
