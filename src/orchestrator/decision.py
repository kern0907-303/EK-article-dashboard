import uuid
from datetime import datetime
from ..database import save_object, get_objects_by_type
from .models import Source, Brand, Asset
from .filter_engine import FilterEngine
from .strategy import BrandStrategyEngine

class DecisionEngine:
    def __init__(self):
        self.filter_engine = FilterEngine()
        self.strategy_engine = BrandStrategyEngine()

    def generate_recommendations(self, brand_id: str = "test-brand") -> dict:
        """
        Decision Engine V3 Pipeline:
        Candidate Topic ➔ Filters (Brand ➔ Audience ➔ Campaign ➔ Product ➔ Guardrail ➔ Asset ➔ Competition)
        ➔ Score ➔ Final Ranking ➔ Recommendation
        """
        # Fetch brand config
        brand = Brand.get(brand_id)
        if brand:
            props = brand["properties"]
            current_product = props.get("current_product_focus", "人生承接力")
            target_audience = props.get("target_audience_segments", ["35~55 女性", "創業者", "企業主"])
            current_campaign = props.get("current_campaign", "打破消耗：中年女性的狀態調整與穩定方案")
        else:
            current_product = "人生承接力"
            target_audience = ["35~55 女性", "創業者", "企業主"]
            current_campaign = "打破消耗：中年女性的狀態調整與穩定方案"

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

        # Raw candidates for daily topics representing different scenarios
        raw_candidates = [
            {
                "topic": "35~55 女性為什麼明明很努力，卻還是覺得狀態接不住？",
                "trend": 18.0, "opportunity": 17.0, "gap": 15.0, "roi": 18.0,
                "priority": "P0", "competition_level": "low", "brand_differentiation": 85.0
            },
            {
                "topic": "不是妳不夠努力，而是妳的狀態已經長期過載。",
                "trend": 17.5, "opportunity": 16.0, "gap": 16.0, "roi": 17.5,
                "priority": "P0", "competition_level": "low", "brand_differentiation": 80.0
            },
            {
                "topic": "35~55 女性的生命數字、天賦與人生節奏定位",
                "trend": 14.0, "opportunity": 12.0, "gap": 16.0, "roi": 13.0,
                "priority": "P1", "competition_level": "low", "brand_differentiation": 75.0
            },
            {
                "topic": "企業主與 CEO 經營決策背後的企業承載力",
                "trend": 15.0, "opportunity": 15.0, "gap": 17.0, "roi": 19.0,
                "priority": "P1", "competition_level": "low", "brand_differentiation": 80.0
            },
            {
                "topic": "探索人生下半場隱形線索與意識結構的關鍵因素",
                "trend": 12.0, "opportunity": 10.0, "gap": 18.0, "roi": 12.0,
                "priority": "P2", "competition_level": "low", "brand_differentiation": 70.0
            },
            {
                "topic": "35~55 女性提升狀態與自我價值的紅海競爭大眾主題",
                "trend": 10.0, "opportunity": 10.0, "gap": 5.0, "roi": 10.0,
                "priority": "P2", "competition_level": "high", "brand_differentiation": 45.0
            },
            {
                "topic": "完全無關品牌定位的主題：如何快速修補腳踏車輪胎",
                "trend": 8.0, "opportunity": 5.0, "gap": 15.0, "roi": 5.0,
                "priority": "P3", "competition_level": "low", "brand_differentiation": 50.0
            }
        ]

        recommended_candidates = []
        rejected_candidates = []

        # Execute V3 Sequential Filters on all candidates
        for cand in raw_candidates:
            topic = cand["topic"]
            
            # Run filters
            filter_res = self.filter_engine.evaluate_topic(
                topic=topic,
                brand_id=brand_id,
                current_product=current_product,
                target_audience=target_audience,
                current_campaign=current_campaign,
                competition_level=cand["competition_level"],
                brand_differentiation=cand["brand_differentiation"]
            )
            
            if not filter_res["passed"]:
                rejected_candidates.append({
                    "topic": topic,
                    "reason": filter_res["reason"]
                })
            else:
                # Passes all filters! Compute V2 score components
                strategy_weight = self.strategy_engine.calculate_strategy_weight(filter_res["rewritten_topic"])
                audience_match = self.strategy_engine.calculate_audience_match(filter_res["rewritten_topic"], target_audience)
                product_match = self.strategy_engine.calculate_product_match(filter_res["rewritten_topic"], current_product)
                
                final_score = (
                    cand["trend"] + 
                    cand["opportunity"] + 
                    cand["gap"] + 
                    cand["roi"] + 
                    strategy_weight + 
                    audience_match + 
                    product_match
                )
                
                recommended_candidates.append({
                    "topic": filter_res["rewritten_topic"],
                    "trend": cand["trend"],
                    "opportunity": cand["opportunity"],
                    "gap": cand["gap"],
                    "roi": cand["roi"],
                    "strategy_weight": strategy_weight,
                    "audience_match": audience_match,
                    "product_match": product_match,
                    "final_score": round(final_score, 2),
                    "priority": cand["priority"],
                    "recommended_format": filter_res["recommended_format"],
                    "passed_guardrail": filter_res["rewritten_topic"] == topic,
                    "original_topic": topic if filter_res["rewritten_topic"] != topic else None
                })

        # Sort recommended candidates by Final Score descending
        recommended_candidates = sorted(recommended_candidates, key=lambda x: x["final_score"], reverse=True)

        # Assemble today's top suggestions
        if recommended_candidates:
            top_candidate = recommended_candidates[0]
            today_top_topic = top_candidate["topic"]
            today_top_format = top_candidate["recommended_format"]
            confidence = 0.95
            
            reason = (
                f"該主題通過所有篩選，配合當前主推產品【{current_product}】獲得最高相關性得分。最終得分：{top_candidate['final_score']}分 "
                f"(其中包含 品牌策略權重 {top_candidate['strategy_weight']}分，受眾契合 {top_candidate['audience_match']}分，"
                f"主推產品加成 {top_candidate['product_match']}分)。推薦格式：{today_top_format}。"
            )
            passed_brand_guardrail = top_candidate["passed_guardrail"]
            original_topic = top_candidate["original_topic"]
            rewritten_topic = top_candidate["topic"] if not passed_brand_guardrail else None
        else:
            today_top_topic = "無合適推薦主題"
            today_top_format = "Facebook"
            confidence = 0.0
            reason = "今天沒有任何候選主題通過篩選過濾器。"
            passed_brand_guardrail = True
            original_topic = None
            rewritten_topic = None

        # Compile formatted daily decision recommendations list
        recommended_topics_output = []
        for idx, item in enumerate(recommended_candidates):
            cta_phrase = "預約 15 分鐘狀態調整支持電話" if "狀態" in item["topic"] else "私訊索取天賦指引手冊"
            recommended_topics_output.append({
                "rank": idx + 1,
                "topic": item["topic"],
                "content_type": item["recommended_format"],
                "cta": cta_phrase,
                "reason": (
                    f"Trend: {item['trend']} | Opp: {item['opportunity']} | Gap: {item['gap']} | ROI: {item['roi']} | "
                    f"Brand: {item['strategy_weight']} | Aud: {item['audience_match']} | Prod: {item['product_match']} | "
                    f"Final Score: {item['final_score']}"
                ),
                "confidence": round(0.95 - (idx * 0.03), 2),
                "final_score": item["final_score"],
                "passed_guardrail": item["passed_guardrail"],
                "original_topic": item["original_topic"]
            })

        decisions = {
            "today_top_source": top_source_name,
            "today_top_content": f"{top_source_name} 關於『女性卓越成長與心態定位』的分享文案",
            "today_top_topic": today_top_topic,
            "today_top_format": today_top_format,
            "reason": reason,
            "confidence_score": confidence,
            "current_product_focus": current_product,
            "target_audience_segments": target_audience,
            "current_campaign": current_campaign,
            "passed_brand_guardrail": passed_brand_guardrail,
            "original_topic": original_topic,
            "rewritten_topic": rewritten_topic,
            # Source Reality Check fields
            "is_mock": source_is_mock,
            "source_confidence": source_confidence,
            "url_status": url_status,
            "source_verified": source_verified,
            # Playlists
            "today_top_5": recommended_topics_output[:5],
            "recommended_topics": recommended_topics_output,
            "rejected_topics": rejected_candidates,
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
