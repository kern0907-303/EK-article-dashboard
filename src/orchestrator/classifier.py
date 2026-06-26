import re

class TaskClassifier:
    def __init__(self):
        # Map keywords to capability tags
        self.rules = [
            (r"(銷售頁|網址|網頁|爬取|http|url|活動頁|研究)", ["scraping", "retrieval"]),
            (r"(分析|萃取|痛點|分析篇|卡點|承載力|觀點)", ["deep_analysis", "pain_point_extraction"]),
            (r"(FB|臉書|貼文|短影音腳本|影片腳本|文案|CTA|翻譯|轉譯|I8|NAS|Erick|品牌|金句|可轉換內容)", ["brand_translation", "copywriting", "cta_generation"]),
            (r"(測驗|問題|問題解答|Quiz)", ["interactive_quiz"]),
            (r"(知識庫|記錄|同步|更新)", ["kb_sync"]),
            (r"(寫程式|代碼|編程|coding)", ["coding"]),
            (r"(Python|腳本|測試|單元測試|debug|檢查|capabilities\.json)", ["syntax_check", "unit_test_run", "code_patching"])
        ]

    def classify(self, task_description: str) -> dict:
        """
        Classifies a task description into required capabilities, estimated tokens, and difficulty.
        """
        required_caps = set()
        
        # Apply rule matching
        for pattern, caps in self.rules:
            if re.search(pattern, task_description, re.IGNORECASE):
                required_caps.update(caps)
                
        # Default fallback capabilities if none match
        if not required_caps:
            required_caps.update(["deep_analysis", "copywriting"])
            
        # Dynamic Token Estimation & Difficulty based on prompt length and matched capabilities
        cap_count = len(required_caps)
        if cap_count >= 5:
            difficulty = "high"
            est_tokens = 8000
        elif cap_count >= 3:
            difficulty = "medium"
            est_tokens = 4500
        else:
            difficulty = "low"
            est_tokens = 2000
            
        # Determine Task Type
        if "coding" in required_caps or "unit_test_run" in required_caps:
            task_type = "Software Engineering & Testing"
        elif "scraping" in required_caps and "copywriting" in required_caps:
            task_type = "Competitive Analysis & Marketing Asset Generation"
        elif "copywriting" in required_caps:
            task_type = "Content Creation"
        else:
            task_type = "General Analytical Task"

        return {
            "task_type": task_type,
            "required_capabilities": sorted(list(required_caps)),
            "difficulty": difficulty,
            "token_estimate": est_tokens
        }
