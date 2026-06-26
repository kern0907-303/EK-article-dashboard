from .guardrail import BrandGuardrail
from .models import Asset
from .strategy import BrandStrategyEngine

class FilterEngine:
    def __init__(self):
        self.guardrail = BrandGuardrail()
        self.strategy_engine = BrandStrategyEngine()

    def evaluate_topic(self, topic: str, brand_id: str = "test-brand",
                       current_product: str = "人生承接力",
                       target_audience: list = None,
                       current_campaign: str = "打破消耗：中年女性的狀態調整與穩定方案",
                       competition_level: str = "low",
                       brand_differentiation: float = 70.0) -> dict:
        """
        Runs a topic sequentially through the 7 V3 filters.
        Returns:
            dict: {
                "passed": bool,
                "reason": str,
                "rewritten_topic": str,
                "recommended_format": str
            }
        """
        rewritten = topic
        target_audience = target_audience or ["35~55 女性", "創業者", "企業主", "CEO"]

        # --- 1. Brand Filter ---
        # Checks if topic contains any keyword associated with erick, NAS, ABL, or I8.
        has_brand_kw = False
        for brand_name, kws in self.strategy_engine.brand_keywords.items():
            for kw in kws:
                if kw in topic:
                    has_brand_kw = True
                    break
        if not has_brand_kw:
            return {"passed": False, "reason": "不符合品牌定位", "rewritten_topic": topic, "recommended_format": "Facebook"}

        # --- 2. Audience Filter ---
        # Checks if topic contains keywords matching target audience segments or fallback general audience tags.
        has_aud_match = False
        audience_kws = ["女性", "創業者", "企業主", "CEO", "35~55", "個人品牌", "老闆", "企業"]
        for kw in target_audience + audience_kws:
            if kw in topic:
                has_aud_match = True
                break
        if not has_aud_match:
            return {"passed": False, "reason": "不符合目前目標受眾", "rewritten_topic": topic, "recommended_format": "Facebook"}

        # --- 3. Campaign Filter ---
        # Checks if topic matches the current active campaign theme.
        # Heuristic: Match keywords from campaign theme to topic context.
        # E.g. campaign contains '狀態調整' -> ABL. Campaign contains '生命數字' -> NAS.
        theme = None
        if any(w in current_campaign for w in ["狀態", "承接力", "消耗", "穩定", "ABL"]):
            theme = "ABL"
        elif any(w in current_campaign for w in ["生命數字", "人格", "天賦", "節奏", "NAS"]):
            theme = "NAS"
        elif any(w in current_campaign for w in ["企業", "經營", "決策", "組織", "I8"]):
            theme = "I8"

        # Check if topic contains words from the matched theme
        if theme:
            words = self.strategy_engine.brand_keywords.get(theme, [])
            has_theme_match = False
            for w in words:
                if w in topic:
                    has_theme_match = True
                    break
            if not has_theme_match:
                return {"passed": False, "reason": "不符合目前活動 (Campaign Mismatch)", "rewritten_topic": topic, "recommended_format": "Facebook"}

        # --- 4. Product Filter ---
        # Checks if topic aligns with the currently active focus product.
        # Active product determines the strict topic theme.
        prod_theme = None
        if "承接力" in current_product or "ABL" in current_product:
            prod_theme = "ABL"
        elif "生命數字" in current_product or "NAS" in current_product:
            prod_theme = "NAS"
        elif "企業" in current_product or "顧問" in current_product or "I8" in current_product:
            prod_theme = "I8"

        if prod_theme:
            words = self.strategy_engine.brand_keywords.get(prod_theme, [])
            has_prod_match = False
            for w in words:
                if w in topic:
                    has_prod_match = True
                    break
            # Allow partial match on product name itself
            if current_product in topic:
                has_prod_match = True

            if not has_prod_match:
                return {"passed": False, "reason": "不符合目前主推產品", "rewritten_topic": topic, "recommended_format": "Facebook"}

        # --- 5. Guardrail Filter ---
        # Scans for forbidden words. Auto-rewrites if violations are found.
        check_res = self.guardrail.check_text(topic, context="ABL")
        if not check_res["passed"]:
            rewritten = self.guardrail.rewrite_text(topic, context="ABL")

        # --- 6. Asset Filter ---
        # Queries Asset Registry to check existing content volumes and adapt formats.
        all_assets = Asset.get_all()
        # Find assets matching this topic (allowing substring match)
        matched_assets = [a for a in all_assets if a["properties"]["topic"] == topic or a["properties"]["topic"] in topic or topic in a["properties"]["topic"]]
        
        fb_count = sum(1 for a in matched_assets if a["properties"]["content_type"].lower() == "facebook")
        blog_count = sum(1 for a in matched_assets if a["properties"]["content_type"].lower() == "blog")
        reels_count = sum(1 for a in matched_assets if a["properties"]["content_type"].lower() == "reels")
        lecture_count = sum(1 for a in matched_assets if a["properties"]["content_type"].lower() == "lecture")

        recommended_format = "Facebook"
        
        # Scenario 7.1: Topic already has 30 Facebook posts -> recommend Reels
        if fb_count >= 30:
            recommended_format = "Reels"
        # Topic already has article (Blog) but no lecture -> recommend Lecture
        elif blog_count >= 1 and lecture_count == 0:
            recommended_format = "Lecture"
            
        # Reject topic entirely if oversaturated (e.g. >= 50 total assets)
        if len(matched_assets) >= 50:
            return {"passed": False, "reason": "已有大量內容 (Oversaturated in Asset Registry)", "rewritten_topic": rewritten, "recommended_format": recommended_format}

        # --- 7. Competition Filter ---
        # Rejects high-competition topics if brand differentiation is insufficient (< 60.0)
        if competition_level == "high" and brand_differentiation < 60.0:
            return {"passed": False, "reason": "市場過度飽和，且品牌差異不足", "rewritten_topic": rewritten, "recommended_format": recommended_format}

        return {
            "passed": True,
            "reason": "Passed all filters",
            "rewritten_topic": rewritten,
            "recommended_format": recommended_format
        }
