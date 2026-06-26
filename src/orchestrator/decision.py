import uuid
from datetime import datetime
from ..database import save_object, get_objects_by_type
from .models import Source, Brand
from .guardrail import BrandGuardrail
from .strategy import BrandStrategyEngine

class DecisionEngine:
    def __init__(self):
        self.guardrail = BrandGuardrail()
        self.strategy_engine = BrandStrategyEngine()

    def generate_recommendations(self, brand_id: str = "test-brand") -> dict:
        """
        Generates daily strategic decision recommendations based on sources and scores.
        Integrates BrandStrategyEngine to evaluate and rank topics using the V2 formula:
        Final Score = Trend + Opportunity + Gap + ROI + Brand Strategy Weight + Audience Match + Current Product Match
        """
        # Fetch brand configurations (active product, target audience)
        brand = Brand.get(brand_id)
        if brand:
            props = brand["properties"]
            current_product = props.get("current_product_focus", "人生承接力")
            target_audience = props.get("target_audience_segments", ["35~55 女性", "創業者", "企業主"])
        else:
            current_product = "人生承接力"
            target_audience = ["35~55 女性", "創業者", "企業主"]

        # Fetch active sources
        sources = Source.get_all()
        active_sources = [s for s in sources if s["lifecycle"] == "Active"]
        
        # Sort by overall score descending
        active_sources = sorted(
            active_sources, 
            key=lambda x: x["properties"].get("overall_source_score", 0.0), 
            reverse=True
        )

        if active_sources:
            top_source = active_sources[0]
            sprops = top_source["properties"]
            top_source_name = sprops.get("name", "Unknown Source")
            top_source_type = sprops.get("source_type", "Website")
            top_source_score = sprops.get("overall_source_score", 0.0)
            
            source_is_mock = sprops.get("is_mock", True)
            source_confidence = sprops.get("source_confidence", "simulated")
            url_status = sprops.get("url_status", "unverified")
            source_verified = (not source_is_mock) or (url_status == "verified")
        else:
            top_source_name = "Tony Robbins Women Leadership Summit"
            top_source_type = "Sales Page"
            top_source_score = 97.57
            source_is_mock = True
            source_confidence = "simulated"
            url_status = "unverified"
            source_verified = False

        # Raw candidates for daily topics representing different brand focus categories
        raw_candidates = [
            {
                "topic": "35~55 女性為什麼明明很努力，卻還是覺得狀態接不住？",
                "trend": 18.0, "opportunity": 17.0, "gap": 15.0, "roi": 18.0,
                "priority": "P0"
            },
            {
                "topic": "不是妳不夠努力，而是妳的狀態已經長期過載。",
                "trend": 17.5, "opportunity": 16.0, "gap": 16.0, "roi": 17.5,
                "priority": "P0"
            },
            {
                "topic": "35~55 女性的生命數字、天賦與人生節奏定位",
                "trend": 14.0, "opportunity": 12.0, "gap": 16.0, "roi": 13.0,
                "priority": "P1"
            },
            {
                "topic": "企業主與 CEO 經營決策背後的企業承載力",
                "trend": 15.0, "opportunity": 15.0, "gap": 17.0, "roi": 19.0,
                "priority": "P1"
            },
            {
                "topic": "探索人生下半場隱形線索與意識結構的關鍵因素",
                "trend": 12.0, "opportunity": 10.0, "gap": 18.0, "roi": 12.0,
                "priority": "P2"
            }
        ]

        # Calculate V2 scores for all candidates
        scored_candidates = []
        for cand in raw_candidates:
            topic = cand["topic"]
            
            # 1. Compute V2 score components
            strategy_weight = self.strategy_engine.calculate_strategy_weight(topic)
            audience_match = self.strategy_engine.calculate_audience_match(topic, target_audience)
            product_match = self.strategy_engine.calculate_product_match(topic, current_product)
            
            final_score = (
                cand["trend"] + 
                cand["opportunity"] + 
                cand["gap"] + 
                cand["roi"] + 
                strategy_weight + 
                audience_match + 
                product_match
            )
            
            # Pass topic through guardrail
            check_res = self.guardrail.check_text(topic, context="ABL")
            passed_guardrail = check_res["passed"]
            rewritten_topic = self.guardrail.rewrite_text(topic, context="ABL")
            
            scored_candidates.append({
                "topic": rewritten_topic if not passed_guardrail else topic,
                "trend": cand["trend"],
                "opportunity": cand["opportunity"],
                "gap": cand["gap"],
                "roi": cand["roi"],
                "strategy_weight": strategy_weight,
                "audience_match": audience_match,
                "product_match": product_match,
                "final_score": round(final_score, 2),
                "priority": cand["priority"],
                "passed_guardrail": passed_guardrail,
                "original_topic": topic if not passed_guardrail else None
            })

        # Sort recommendations by V2 Final Score descending
        scored_candidates = sorted(scored_candidates, key=lambda x: x["final_score"], reverse=True)

        # Assemble today's top suggestions
        top_topic_info = scored_candidates[0]
        today_top_topic = top_topic_info["topic"]
        top_content = f"{top_source_name} 關於『女性卓越成長與心態定位』的分享文案"
        top_format = "Facebook 貼文 + 狀態指引手冊"
        confidence = 0.95
        
        # Build compliant rationale reflecting the V2 scores
        reason = (
            f"該主題配合當前主推產品【{current_product}】獲得最高相關性得分。最終得分：{top_topic_info['final_score']}分 "
            f"(其中包含 品牌策略權重 {top_topic_info['strategy_weight']}分，受眾契合 {top_topic_info['audience_match']}分，"
            f"主推產品加成 {top_topic_info['product_match']}分)。"
        )

        today_top_5 = []
        for idx, item in enumerate(scored_candidates):
            today_top_5.append({
                "rank": idx + 1,
                "topic": item["topic"],
                "priority": item["priority"],
                "impact": "high" if idx < 2 else ("medium" if idx < 4 else "low"),
                "confidence": round(0.95 - (idx * 0.03), 2),
                "reason": (
                    f"Trend: {item['trend']} | Opp: {item['opportunity']} | Gap: {item['gap']} | ROI: {item['roi']} | "
                    f"Brand: {item['strategy_weight']} | Aud: {item['audience_match']} | Prod: {item['product_match']} | "
                    f"Final: {item['final_score']}"
                ),
                "passed_guardrail": item["passed_guardrail"],
                "original_topic": item["original_topic"],
                "final_score": item["final_score"]
            })

        decisions = {
            "today_top_source": top_source_name,
            "today_top_content": top_content,
            "today_top_topic": today_top_topic,
            "today_top_format": top_format,
            "reason": reason,
            "confidence_score": confidence,
            "current_product_focus": current_product,
            "target_audience_segments": target_audience,
            # Source Reality Check fields
            "is_mock": source_is_mock,
            "source_confidence": source_confidence,
            "url_status": url_status,
            "source_verified": source_verified,
            # Brand Guardrail compliance logs
            "passed_brand_guardrail": top_topic_info["passed_guardrail"],
            "original_topic": top_topic_info["original_topic"] or today_top_topic,
            "rewritten_topic": today_top_topic,
            # Playlists
            "today_top_5": today_top_5,
            "weekly_top_10": [
                {"topic": "35~55 女性的承接力與自我價值重塑", "priority": "P0", "confidence": 0.94},
                {"topic": "如何降低個人品牌的內在消耗", "priority": "P1", "confidence": 0.89}
            ],
            "monthly_campaign": {
                "theme": "打破消耗：中年女性的狀態調整與穩定方案",
                "campaign_goals": ["吸引 20 位潛在高階諮詢意向者", "完成 5 場 ABL 直播公開課"]
            }
        }

        # Save Decision object in database
        decision_id = f"decision_run_{str(uuid.uuid4())[:8]}"
        save_object(
            obj_id=decision_id,
            obj_type="Decision",
            properties=decisions,
            lifecycle="Active",
            owner=brand_id
        )
        
        return decisions
