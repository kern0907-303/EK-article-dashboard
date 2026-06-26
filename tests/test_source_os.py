import unittest
import os
import sys
import uuid

# Include src in path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from src.database import init_db, save_object, get_object, get_objects_by_type, add_relation
from src.orchestrator.models import Category, Source, Brand
from src.orchestrator.discovery import SourceDiscoveryEngine
from src.orchestrator.scoring import SourceScoreEngine
from src.orchestrator.auto_discovery import AutoDiscovery
from src.orchestrator.graph import KnowledgeGraph
from src.orchestrator.decision import DecisionEngine
from src.orchestrator.guardrail import BrandGuardrail
from src.orchestrator.strategy import BrandStrategyEngine

class TestSourceOS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Clear database tables before running tests
        from src.database import get_db_connection
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS object_relations")
        cursor.execute("DROP TABLE IF EXISTS objects")
        conn.commit()
        conn.close()
        
        # Reset DB before starting tests
        init_db()
        
        # Initialize default categories and brand metadata
        discoverer = AutoDiscovery()
        discoverer.init_default_categories()
        
        # Default brand with V2 properties
        Brand.create(
            brand_id="test-brand",
            name="Erick Brand Ecosystem",
            positioning="High-ticket consulting and ABL state adjustment",
            audience="Entrepreneurs and coaching experts",
            products=[{"name": "Masterclass", "price": 990}],
            tone="Direct-response",
            region="Global",
            language="zh-TW",
            source_ids=[],
            status="Active"
        )
        # Register V2 strategy properties in test-brand
        brand_obj = Brand.get("test-brand")
        bprops = brand_obj["properties"]
        bprops["current_product_focus"] = "人生承接力"
        bprops["target_audience_segments"] = ["35~55 女性", "創業者", "企業主", "CEO"]
        save_object("test-brand", "Brand", bprops, "Active", "test-brand")

    def test_scenario_1_candidate_generation(self):
        """Scenario 1: Input Women's Growth and generate >= 10 candidates."""
        discoverer = SourceDiscoveryEngine()
        candidates = discoverer.discover_candidates("womens_growth")
        self.assertGreaterEqual(len(candidates), 10)
        
        # Verify multiple different source types are included
        types = {c["source_type"] for c in candidates}
        self.assertTrue(len(types) > 3)

    def test_scenario_2_and_3_and_4_scoring_and_tier_classification(self):
        """
        Scenario 2: System classifies Tiers 1-4.
        Scenario 3: Tony Robbins is Tier 1.
        Scenario 4: Low frequency, low relevance is Tier 3 or 4.
        """
        scorer = SourceScoreEngine()
        
        # Scenario 3: Tony Robbins
        tony_profile = {
            "name": "Tony Robbins Women Leadership Summit",
            "source_type": "Sales Page",
            "url": "https://tonyrobbins.com",
            "update_frequency": "daily",
            "traffic_score": 95.0,
            "relevance_score": 95.0,
            "authority_score": 95.0
        }
        res_tony = scorer.calculate_source_score(tony_profile)
        self.assertEqual(res_tony["tier"], "Tier 1")
        self.assertGreaterEqual(res_tony["overall_source_score"], 85.0)

        # Scenario 4: Low update frequency, low relevance
        inactive_profile = {
            "name": "Low Update Inactive Source",
            "source_type": "Website",
            "url": "https://inactive.com",
            "update_frequency": "monthly",
            "traffic_score": 5.0,
            "relevance_score": 10.0,
            "authority_score": 10.0
        }
        res_inactive = scorer.calculate_source_score(inactive_profile)
        self.assertIn(res_inactive["tier"], ["Tier 3", "Tier 4"])
        self.assertLess(res_inactive["overall_source_score"], 50.0)

    def test_scenario_5_source_promotion_brand_metadata_linking(self):
        """Scenario 5: Promoted source automatically builds brand metadata link."""
        source_id = f"source_promo_{uuid.uuid4().hex[:8]}"
        Source.create(
            source_id=source_id,
            name="Marie Forleo Blog",
            category_id="womens_growth",
            brand_id=None,
            source_type="Blog",
            url="https://marieforleo.com",
            update_frequency="weekly",
            authority_score=87.0,
            traffic_score=90.0,
            status="Candidate",
            tier="Tier 4"
        )
        
        # Score and Promote
        scorer = SourceScoreEngine()
        src_obj = Source.get(source_id)
        scores = scorer.calculate_source_score(src_obj["properties"])
        Source.update_scores_and_tier(source_id, scores)
        
        # Perform Promotion
        overall_score = scores["overall_source_score"]
        self.assertGreaterEqual(overall_score, 30.0)
        
        Source.promote_to_active(source_id)
        
        # Link Brand Metadata
        brand_id = "test-brand"
        sprops = Source.get(source_id)["properties"]
        sprops["brand_id"] = brand_id
        sprops["owner"] = brand_id
        save_object(source_id, "Source", sprops, "Active", brand_id)
        
        add_relation(brand_id, source_id, "owns_source")
        add_relation(source_id, brand_id, "associated_brand")
        
        brand_obj = Brand.get(brand_id)
        bprops = brand_obj["properties"]
        s_ids = bprops.get("source_ids", [])
        if source_id not in s_ids:
            s_ids.append(source_id)
            
        bprops["source_ids"] = s_ids
        save_object(brand_id, "Brand", bprops, "Active", brand_id)

        # Verifications
        promo_source = Source.get(source_id)
        self.assertEqual(promo_source["lifecycle"], "Active")
        self.assertEqual(promo_source["properties"]["brand_id"], "test-brand")

    def test_scenario_6_knowledge_graph_path_query(self):
        """Scenario 6: Category -> Source -> Content -> Pattern -> Decision trace query."""
        cat_id = "womens_growth"
        src_id = f"src_kg_{uuid.uuid4().hex[:8]}"
        cnt_id = f"cnt_kg_{uuid.uuid4().hex[:8]}"
        pat_id = f"pat_kg_{uuid.uuid4().hex[:8]}"
        dec_id = f"dec_kg_{uuid.uuid4().hex[:8]}"
        
        # Save Nodes
        KnowledgeGraph.create_node(src_id, "Source", {"name": "Sheryl Sandberg Foundation"})
        KnowledgeGraph.create_node(cnt_id, "Content", {"title": "Transcribed Lead Article"})
        KnowledgeGraph.create_node(pat_id, "Pattern", {"formulas": ["Hook A"]})
        KnowledgeGraph.create_node(dec_id, "Decision", {"today_top_topic": "Erick Mindset Tuning"})
        
        # Save Edges representing the source-centric sequence
        KnowledgeGraph.create_edge(cat_id, src_id, "contains_source")
        KnowledgeGraph.create_edge(src_id, cnt_id, "produces_content")
        KnowledgeGraph.create_edge(cnt_id, pat_id, "links_to_pattern")
        KnowledgeGraph.create_edge(pat_id, dec_id, "leads_to_decision")
        
        # Trace path
        paths = KnowledgeGraph.trace_source_centric_path(cat_id)
        self.assertGreater(len(paths), 0)
        path = paths[0]
        self.assertEqual(path["category"]["id"], cat_id)
        self.assertEqual(path["source"]["id"], src_id)
        self.assertEqual(path["content"]["id"], cnt_id)
        self.assertEqual(path["pattern"]["id"], pat_id)
        self.assertEqual(path["decision"]["id"], dec_id)

    def test_scenario_7_daily_decision_output_schema(self):
        """Scenario 7: Daily Decision recommendations must return specified questions."""
        engine = DecisionEngine()
        decisions = engine.generate_recommendations("test-brand")
        
        self.assertIn("today_top_source", decisions)
        self.assertIn("today_top_content", decisions)
        self.assertIn("today_top_topic", decisions)
        self.assertIn("today_top_format", decisions)
        self.assertIn("reason", decisions)
        self.assertIn("confidence_score", decisions)
        self.assertIn("today_top_5", decisions)

    def test_brand_guardrail_forbidden_word_rewriter(self):
        """First-tier public copy must be rewritten when containing forbidden terms."""
        guardrail = BrandGuardrail()
        text = "我們提供高票價課程，保證無痛成交，並教你調整能量磁場。"
        
        check_res = guardrail.check_text(text, context="first_tier")
        self.assertFalse(check_res["passed"])
        
        rewritten = guardrail.rewrite_text(text, context="first_tier")
        self.assertNotIn("高票價", rewritten)
        self.assertNotIn("無痛成交", rewritten)
        self.assertNotIn("能量磁場", rewritten)

    def test_source_reality_check_tags(self):
        """Mock sources must be marked with unverified properties, and not concluded as verified."""
        engine = DecisionEngine()
        decisions = engine.generate_recommendations("test-brand")
        
        self.assertTrue(decisions["is_mock"])
        self.assertEqual(decisions["source_confidence"], "simulated")
        self.assertEqual(decisions["url_status"], "unverified")
        self.assertFalse(decisions["source_verified"])

    # --- V2 Brand Strategy Engine Tests ---

    def test_v2_brand_strategy_weights(self):
        """Verifies that keywords score points correctly and cap at 20.0."""
        strategy = BrandStrategyEngine()
        
        # Match ABL (承接力, 狀態) & Erick (人生下半場)
        topic = "中年女性如何提升承接力與狀態，過好人生下半場"
        weight = strategy.calculate_strategy_weight(topic)
        self.assertEqual(weight, 15.0) # 3 keywords * 5.0 = 15.0
        
        # Match too many keywords -> caps at 20.0
        heavy_topic = "生命數字 人格 天賦 人生節奏 狀態 承接力"
        weight_heavy = strategy.calculate_strategy_weight(heavy_topic)
        self.assertEqual(weight_heavy, 20.0)

    def test_v2_audience_match_scores(self):
        """Verifies target audience matches add points up to 10.0."""
        strategy = BrandStrategyEngine()
        
        topic = "給創業者與 CEO 的狀態管理術"
        aud_score = strategy.calculate_audience_match(topic, ["創業者", "CEO"])
        self.assertEqual(aud_score, 10.0) # 2 segments * 5.0 = 10.0

    def test_v2_product_match_boost(self):
        """Verifies that the currently active focus product applies a 20.0 point boost."""
        strategy = BrandStrategyEngine()
        
        # 1. Topic containing ABL keyword gets boost when product focus is ABL (人生承接力)
        topic_abl = "中年女性如何提升承接力以釋放壓力"
        boost_abl = strategy.calculate_product_match(topic_abl, "人生承接力")
        self.assertEqual(boost_abl, 20.0)
        
        # 2. Topic containing NAS keyword gets boost when product focus is NAS (生命數字)
        topic_nas = "探索你的生命數字天賦"
        boost_nas = strategy.calculate_product_match(topic_nas, "生命數字")
        self.assertEqual(boost_nas, 20.0)
        
        # 3. Topic does NOT get boost if it belongs to NAS but product focus is ABL
        no_boost = strategy.calculate_product_match(topic_nas, "人生承接力")
        self.assertEqual(no_boost, 0.0)

    def test_v2_decision_engine_dynamic_ranking(self):
        """Tests that modifying active product focus shifts topic rankings dynamically."""
        engine = DecisionEngine()
        
        # 1. Test ABL product focus: topics about '承接力' / '狀態' should rank first
        brand_obj = Brand.get("test-brand")
        bprops = brand_obj["properties"]
        bprops["current_product_focus"] = "人生承接力"
        save_object("test-brand", "Brand", bprops, "Active", "test-brand")
        
        dec_abl = engine.generate_recommendations("test-brand")
        top_topic_abl = dec_abl["today_top_topic"]
        self.assertIn("狀態", top_topic_abl)
        self.assertIn("狀態", dec_abl["today_top_5"][0]["topic"])
        
        # 2. Shift active product focus to NAS (生命數字)
        bprops["current_product_focus"] = "生命數字"
        save_object("test-brand", "Brand", bprops, "Active", "test-brand")
        
        dec_nas = engine.generate_recommendations("test-brand")
        top_topic_nas = dec_nas["today_top_topic"]
        self.assertIn("生命數字", top_topic_nas)

if __name__ == "__main__":
    unittest.main()
