import uuid
from datetime import datetime
from ..database import save_object, get_objects_by_type
from .models import Source
from .guardrail import BrandGuardrail

class DecisionEngine:
    def __init__(self):
        self.guardrail = BrandGuardrail()

    def generate_recommendations(self, brand_id: str = "test-brand") -> dict:
        """
        Generates daily strategic decision recommendations based on sources and scores.
        Validates all suggested topics against BrandGuardrail and performs reality checks on sources.
        """
        # Fetch active sources
        sources = Source.get_all()
        active_sources = [s for s in sources if s["lifecycle"] == "Active"]
        
        # Sort by overall score descending
        active_sources = sorted(
            active_sources, 
            key=lambda x: x["properties"].get("overall_source_score", 0.0), 
            reverse=True
        )

        # Retrieve top source properties
        if active_sources:
            top_source = active_sources[0]
            props = top_source["properties"]
            top_source_name = props.get("name", "Unknown Source")
            top_source_type = props.get("source_type", "Website")
            top_source_score = props.get("overall_source_score", 0.0)
            
            # Source Reality Check fields
            source_is_mock = props.get("is_mock", True)
            source_confidence = props.get("source_confidence", "simulated")
            url_status = props.get("url_status", "unverified")
            source_verified = (not source_is_mock) or (url_status == "verified")
        else:
            # Fallback mock source values
            top_source_name = "Tony Robbins Women Leadership Summit"
            top_source_type = "Sales Page"
            top_source_score = 97.57
            source_is_mock = True
            source_confidence = "simulated"
            url_status = "unverified"
            source_verified = False

        # Define original metaphysical/sales-heavy topic (Scenario check)
        original_topic = "如何透過 ABL 能量磁場與價值階梯無痛成交高票價諮詢"
        
        # Pass topic through Brand Guardrail
        check_res = self.guardrail.check_text(original_topic, context="ABL")
        passed_guardrail = check_res["passed"]
        
        # Automatically rewrite topic to be compliant
        rewritten_topic = self.guardrail.rewrite_text(original_topic, context="ABL")
        
        # Set final recommended topic
        today_top_topic = rewritten_topic if not passed_guardrail else original_topic
        
        # Generate other content suggestions
        top_content = f"{top_source_name} 關於『女性卓越成長與心態定位』的分享文案"
        top_format = "Facebook 貼文 + 狀態指引手冊"
        confidence = 0.95
        
        # Build compliant rationale
        raw_reason = f"該來源 ({top_source_name}) 評分為 {top_source_score}分。其高票價 Secrets 漏斗與我們的 ABL 能量調整系統有強烈互補性，無痛成交首選。"
        reason = self.guardrail.rewrite_text(raw_reason, context="ABL")

        # Today's Top 5 Topics (all filtered and compliant)
        raw_top_5 = [
            {"rank": 1, "topic": original_topic, "priority": "P0", "impact": "high", "confidence": confidence, "reason": raw_reason},
            {"rank": 2, "topic": "為什麼賣 $990 的線上課是慢性自殺？", "priority": "P0", "impact": "high", "confidence": 0.92, "reason": "高轉化痛點，切中受眾精力耗盡的痛點"},
            {"rank": 3, "topic": "如何用 Russell Brunson 的價值階梯重新包裝諮詢服務", "priority": "P1", "impact": "medium", "confidence": 0.88, "reason": "價值階梯概念在市場搜尋量上升中"},
            {"rank": 4, "topic": "能量磁場調頻：在文案撰寫前做這三件事", "priority": "P1", "impact": "medium", "confidence": 0.85, "reason": "微調頻教學能有效增長自然互動"},
            {"rank": 5, "topic": "Dream 100 實戰指南：找到你夢想客戶的流量池", "priority": "P2", "impact": "low", "confidence": 0.80, "reason": "補充型長青內容，適合長線布局"}
        ]

        today_top_5 = []
        for item in raw_top_5:
            topic_check = self.guardrail.check_text(item["topic"], context="ABL")
            topic_rewritten = self.guardrail.rewrite_text(item["topic"], context="ABL")
            reason_rewritten = self.guardrail.rewrite_text(item["reason"], context="ABL")
            
            today_top_5.append({
                "rank": item["rank"],
                "topic": topic_rewritten,
                "priority": item["priority"],
                "impact": item["impact"],
                "confidence": item["confidence"],
                "reason": reason_rewritten,
                "passed_guardrail": topic_check["passed"],
                "original_topic": item["topic"] if not topic_check["passed"] else None
            })

        decisions = {
            "today_top_source": top_source_name,
            "today_top_content": top_content,
            "today_top_topic": today_top_topic,
            "today_top_format": top_format,
            "reason": reason,
            "confidence_score": confidence,
            # Source Reality Check fields
            "is_mock": source_is_mock,
            "source_confidence": source_confidence,
            "url_status": url_status,
            "source_verified": source_verified,
            # Brand Guardrail compliance logs
            "passed_brand_guardrail": passed_guardrail,
            "original_topic": original_topic,
            "rewritten_topic": rewritten_topic,
            # Playlists
            "today_top_5": today_top_5,
            "weekly_top_10": [
                {"topic": "從零開始做 $50,000 的高階諮詢定位", "priority": "P0", "confidence": 0.94},
                {"topic": "Erick ABL 系統與個人能量定位的底層邏輯", "priority": "P1", "confidence": 0.89}
            ],
            "monthly_campaign": {
                "theme": "破局低價：重構你的高票價商業價值階梯",
                "campaign_goals": ["吸引 20 位潛在高階諮詢意向者", "完成 5 場 ABL 直播公開課"]
            }
        }
        
        # Apply guardrail to all weekly/monthly texts
        decisions["monthly_campaign"]["theme"] = self.guardrail.rewrite_text(decisions["monthly_campaign"]["theme"], context="ABL")
        decisions["monthly_campaign"]["campaign_goals"] = [
            self.guardrail.rewrite_text(g, context="ABL") for g in decisions["monthly_campaign"]["campaign_goals"]
        ]
        for w in decisions["weekly_top_10"]:
            w["topic"] = self.guardrail.rewrite_text(w["topic"], context="ABL")

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
