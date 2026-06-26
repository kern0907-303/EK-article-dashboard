import uuid
from ..database import save_object, add_relation
from ..agents.chatgpt_agent import translate_and_create

class ContentFactory:
    def generate_assets(self, brand_id: str, topic: str, brand_info: dict) -> str:
        """
        Generates copywriting assets based on topic and brand guidelines.
        Saves the results as a Content Object in SQLite.
        """
        # Formulate a mock card to pass to translator agent
        mock_card = {
            "title": topic,
            "summary": f"針對主題 {topic} 進行行銷定位與受眾痛點切入。",
            "key_themes": ["價值階梯", "品牌調頻", "定位"],
            "target_audience": {
                "profile": brand_info.get("target_audience", "創業家、顧問與自由職業主。"),
                "pain_points": [
                    "時間被廉價諮詢綁架，無法突破營收卡點",
                    "缺乏高單價後端服務路徑"
                ]
            },
            "emotional_triggers": ["不甘心低利潤忙碌", "追求時間自由與成就感"],
            "key_claims": ["狀態與能量調整是高價諮詢成交的前提。"],
            "hooks": [f"為什麼你的 {topic} 遲遲沒有轉換率？原因只有一個。"]
        }
        
        # Invoke chatgpt agent dynamically
        assets = translate_and_create(mock_card, brand_info)
        
        content_id = f"content_{str(uuid.uuid4())[:8]}"
        save_object(
            obj_id=content_id,
            obj_type="Content",
            properties={
                "topic": topic,
                "assets": assets
            },
            lifecycle="Draft",
            owner=brand_id
        )
        # Link Brand to Content
        add_relation(brand_id, content_id, "owns")
        
        return content_id
