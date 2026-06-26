class BrandStrategyEngine:
    def __init__(self):
        # Priority keyword tables per brand context
        self.brand_keywords = {
            "erick": ["意識結構", "隱形線索", "人生下半場", "健康", "關係", "財富"],
            "NAS": ["生命數字", "人格", "天賦", "人生節奏"],
            "ABL": ["狀態", "承接力", "內在消耗", "自我價值", "穩定"],
            "I8": ["決策", "組織", "經營", "團隊", "企業承載力"]
        }

        # Target audience keywords
        self.audience_targets = ["35~55 女性", "創業者", "企業主", "CEO", "女性", "創業"]

    def calculate_strategy_weight(self, topic: str) -> float:
        """
        Scans topic for brand priority keywords.
        Returns a score from 0.0 to 20.0 (+5.0 per matched keyword, capped at 20.0).
        """
        score = 0.0
        matched_words = []
        
        # Check all keywords across all brands
        for brand_name, words in self.brand_keywords.items():
            for w in words:
                if w in topic and w not in matched_words:
                    matched_words.append(w)
                    score += 5.0
                    
        return min(20.0, score)

    def calculate_audience_match(self, topic: str, audience_list: list = None) -> float:
        """
        Evaluates match with active audience profiles.
        Returns a score from 0.0 to 10.0 (+5.0 per matched segment, capped at 10.0).
        """
        score = 0.0
        targets = audience_list or self.audience_targets
        
        for t in targets:
            if t in topic:
                score += 5.0
                
        return min(10.0, score)

    def calculate_product_match(self, topic: str, current_product: str) -> float:
        """
        Applies a boost score (0.0 to 20.0) if a topic aligns with the active focus product.
        Products:
          - '人生承接力' (ABL aligned: 狀態, 承接力, 內在消耗, 自我價值, 穩定)
          - '生命數字' (NAS aligned: 生命數字, 人格, 天賦, 人生節奏)
          - '企業顧問' (I8 aligned: 決策, 組織, 經營, 團隊, 企業承載力)
        """
        if not current_product:
            return 0.0
            
        # Determine theme mapping
        theme = None
        if "承接力" in current_product or "ABL" in current_product:
            theme = "ABL"
        elif "生命數字" in current_product or "NAS" in current_product:
            theme = "NAS"
        elif "企業" in current_product or "顧問" in current_product or "I8" in current_product:
            theme = "I8"
            
        if not theme:
            return 0.0

        # Scan for matching keyword theme in topic
        words = self.brand_keywords.get(theme, [])
        for w in words:
            if w in topic:
                return 20.0 # High match boost
                
        # Partial match on product name itself
        if current_product in topic:
            return 20.0
            
        return 0.0
