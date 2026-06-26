import os
import json
import urllib.request
from .utils import get_api_key, read_prompt

def translate_and_create(intelligence_card: dict, brand_info: dict) -> dict:
    """
    Translates the intelligence card into brand-aligned assets.
    In Mock mode, generates assets dynamically.
    In Real mode, calls ChatGPT API.
    """
    api_key = get_api_key("OPENAI_API_KEY")
    prompt = read_prompt("chatgpt_translate.txt")
    
    brand_name = brand_info.get("name", "Erick Personal Brand")
    brand_framework = brand_info.get("brand_framework", "ABL")
    tone_of_voice = brand_info.get("tone_of_voice", "Inspiring, direct-response")
    
    # 2. Check if Mock or Real
    if not api_key:
        # Mock mode
        # Generate assets based on the intelligence card
        title = intelligence_card.get("title", "Business Scaling")
        summary = intelligence_card.get("summary", "")
        themes = ", ".join(intelligence_card.get("key_themes", []))
        
        mock_assets = {
            "brand_translation": f"Translated the core topic '{title}' using the {brand_name} guidelines (Framework: {brand_framework}). Shifted the perspective from pure marketing techniques to state-alignment (ABL) and energy dynamics. Adjusted the tone to be {tone_of_voice}.",
            "facebook_post": f"🚀 【你被你的低價產品綁架了嗎？】 🚀\n\n每天工作 16 個小時，只為了賣出一堂 $990 的線上課？\n這不是在創業，這是在幫自己找一份低薪工作！\n\n很多創作者跟企業家都陷入了這個盲點。但事實上：\n👉 賣一堂 $30,000 的高階諮詢，比賣 30 堂 $990 的課程還要簡單！\n\n只要你掌握了兩個關鍵步驟：\n1️⃣ 【ABL 能量狀態調頻】：在你寫出任何文案前，先調頻你的大腦與能量。狀態不對，寫出來的字就沒有說服力！\n2️⃣ 【價值階梯設計】：不要只賣便宜貨，設計一條讓夢想客戶不斷升級的價值路徑。\n\n準備好打破低價詛咒了嗎？\n\n📌 留言「我願意」，我私訊你【高價能量調頻指南】！\n\n#個人品牌 #高價值行銷 #狀態調整 #ABL系統 #RussellBrunson",
            "short_video_script": f"【短影音企劃：低價課正在毀掉你的生活？】\n\n[0-3s Hook]\n（鏡頭特寫：抱頭崩潰）\n旁白：『別再賣 $990 的便宜課了！那是你每天加班的元凶！』\n\n[3-45s Body]\n（鏡頭切換：站在白板前，指著畫好的梯子）\n旁白：『很多人以為便宜比較好賣，錯！\n賣高價產品的人，花的時間更少，因為他們只服務 20% 的頂級客戶！\n首先，你要做 ABL 能量調整。每次行銷前，深呼吸，進入巔峰狀態。\n接著，畫出你的價值階梯。從免費影片，引導到高價一對一諮詢。』\n\n[45-60s CTA]\n（鏡頭切換：微笑，手指向下方）\n旁白：『想知道如何從零設計你的高價服務？點擊我頭像，私訊「高價」，我把免費教學發給你！』",
            "call_to_action": f"點擊連結，立即預約免費一對一「高價值事業定位諮詢」，名額有限：https://erickbrand.com/apply",
            "quiz_questions": [
                {
                    "question": f"根據 {brand_name} 的 ABL 系統，在進行行銷文案撰寫前，第一步應該做什麼？",
                    "options": [
                        "A. 先做 ABL 能量狀態調整與調頻",
                        "B. 立刻上網參考競爭對手的文案",
                        "C. 設計便宜的低價課程吸引流量",
                        "D. 直接花錢投放廣告測試市場"
                    ],
                    "answer": "A. 先做 ABL 能量狀態調整與調頻"
                },
                {
                    "question": "價值階梯（Value Ladder）的核心目的何在？",
                    "options": [
                        "A. 讓所有客戶都只能買便宜的前端產品",
                        "B. 設計一套讓夢想客戶能逐步升級到高價後端服務的產品路徑",
                        "C. 節省開發新產品的時間",
                        "D. 取代所有的行銷漏斗"
                    ],
                    "answer": "B. 設計一套讓夢想客戶能逐步升級到高價後端服務的產品路徑"
                }
            ]
        }
        return mock_assets
        
    # Real mode: Call OpenAI API using urllib
    url = "https://api.openai.com/v1/chat/completions"
    system_content = f"{prompt}\n\nBrand guidelines:\nName: {brand_name}\nFramework: {brand_framework}\nTone: {tone_of_voice}\nDescription: {brand_info.get('description', '')}\nTarget: {brand_info.get('target_audience', '')}"
    user_content = f"Content Intelligence Card JSON:\n{json.dumps(intelligence_card, ensure_ascii=False)}"
    
    data = {
        "model": "gpt-4o-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content}
        ]
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
            response_text = result['choices'][0]['message']['content'].strip()
            return json.loads(response_text)
    except Exception as e:
        print(f"ChatGPT API call failed ({e}). Falling back to Mock.")
        return {
            "brand_translation": f"Fallback: API Error {str(e)}",
            "facebook_post": "Fallback post content.",
            "short_video_script": "Fallback script content.",
            "call_to_action": "Fallback CTA",
            "quiz_questions": []
        }
