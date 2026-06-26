import re

class BrandGuardrail:
    def __init__(self):
        # Forbidden words per brand context
        self.rules = {
            "first_tier": [
                "能量磁場", "信息場", "頻率", "調頻", "高票價", "無痛成交"
            ],
            "ABL": [
                "能量磁場", "信息場", "頻率", "調頻", "高票價", "無痛成交", 
                "療效", "療效承諾", "根治", "包治", "治癒"
            ],
            "NAS": [
                "信息場", "調頻", "能量磁場"
            ],
            "I8": [
                "靈性", "頻率", "能量場", "顯化", "療癒"
            ],
            "erick": [
                # Erick brand can use these abstract words, but we lower abstractness for public copy
                "能量磁場", "信息場", "頻率", "調頻", "高票價", "無痛成交"
            ]
        }

        # Replacements for rewriting forbidden words
        self.replacements = {
            "能量磁場": "狀態",
            "信息場": "內在狀態",
            "能量場": "內在狀態",
            "頻率": "狀態",
            "調頻": "調整狀態",
            "高票價": "高價值",
            "無痛成交": "精準定位",
            "顯化": "具體呈現",
            "療癒": "支持與舒緩",
            "靈性": "內在意識",
            "療效": "改善與支持",
            "治癒": "舒緩與安定"
        }

        # Specific mappings for known metaphysical/sales-heavy topics (matching full string)
        self.topic_mappings = [
            (r"如何透過.*能量磁場.*無痛成交.*高票價.*", "中年女性為什麼明明很努力，卻還是覺得狀態接不住？"),
            (r"如何透過.*能量磁場.*無痛成交.*", "不是妳不夠努力，而是妳的狀態已經長期過載。"),
            (r"能量磁場與價值階梯", "內在狀態與價值承接力"),
            (r"成交高票價的核心祕訣", "高價值定位與狀態穩定的核心祕訣"),
            (r"無痛成交高階諮詢", "精準定位並建立高價值諮詢"),
            (r"顯化財富與靈性頻率調整", "提升自我價值與狀態穩定"),
            (r"能量場與顯化", "內在狀態與具體呈現"),
            (r"療癒與靈性", "支持與內在意識")
        ]

    def check_text(self, text: str, context: str = "first_tier") -> dict:
        """
        Scans text against context rules.
        """
        violated = []
        forbidden_list = self.rules.get(context, self.rules["first_tier"])
        
        for word in forbidden_list:
            if word in text:
                violated.append(word)
                
        return {
            "passed": len(violated) == 0,
            "violated_words": violated
        }

    def rewrite_text(self, text: str, context: str = "first_tier") -> str:
        """
        Checks text and automatically rewrites it to be compliant.
        """
        rewritten = text

        # 1. Try to match specific known topic mappings first (full string patterns)
        for pattern, replacement in self.topic_mappings:
            if re.search(pattern, rewritten):
                rewritten = re.sub(pattern, replacement, rewritten)
                return rewritten

        # 2. General word replacement
        forbidden_list = self.rules.get(context, self.rules["first_tier"])
        for word in forbidden_list:
            if word in rewritten:
                rep_word = self.replacements.get(word, "狀態")
                rewritten = rewritten.replace(word, rep_word)

        # 3. Clean up generic ABL specific phrasing if applicable
        if context == "ABL":
            if "能量" in rewritten:
                rewritten = rewritten.replace("能量", "狀態")

        return rewritten
