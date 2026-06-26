import os
import json
import uuid
from datetime import datetime
from ..database import save_object, add_relation, get_db_connection

class MockRunner:
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.storage_raw = os.path.join(self.base_dir, "storage", "raw")
        self.storage_clean = os.path.join(self.base_dir, "storage", "clean")
        self.storage_assets = os.path.join(self.base_dir, "storage", "assets")
        
        os.makedirs(self.storage_raw, exist_ok=True)
        os.makedirs(self.storage_clean, exist_ok=True)
        os.makedirs(self.storage_assets, exist_ok=True)

    def execute_route(self, task_id: str, route_sequence: list, task_description: str) -> dict:
        """
        Simulates the execution of the routed agent sequence.
        Saves all generated data as standardized Domain Objects and links them.
        """
        outputs = {}
        title = "競品分析與行銷轉譯"
        if "分析" in task_description:
            try:
                title = task_description.split("分析")[1].split("，")[0].strip()
            except:
                pass
                
        step_order = 1
        
        # Log Plugin Objects registration (just to satisfy registry config)
        save_object("firecrawl_scraper", "Plugin", {"name": "Firecrawl Scraper", "type": "monitor"}, "Active", "system")
        save_object("opportunity_scorer", "Plugin", {"name": "Opportunity Scorer", "type": "scoring"}, "Active", "system")
        
        for model in route_sequence:
            print(f"-> Dispatching event: [run_step_{step_order}] for Agent [{model.upper()}]...")
            
            # 1. Log Event Object
            event_id = str(uuid.uuid4())
            save_object(
                obj_id=event_id,
                obj_type="Event",
                properties={"step": step_order, "agent": model, "description": f"Triggered execution of {model}"},
                lifecycle="Triggered",
                owner=task_id
            )
            add_relation(task_id, event_id, "triggers", {"timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})
            
            # 2. Mock Agent Executions
            if model == "gemini":
                # Collector Output -> Article Object
                output_data = f"""# 競品分析報告: {title}
## 擷取時間: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
## 原始來源: 競品行銷銷售頁 (Competitor Sales Page)

### 銷售頁核心內文結構
本頁面描述了一套針對高單價諮詢服務設計的銷售漏斗。其商業模式主要仰賴 Russell Brunson 的 Secrets 系列框架（Hook-Story-Offer），引導使用者從小額的前端課程（$990）逐步攀升至後端的高階大師班（$50,000）。
"""
                article_id = f"article_{task_id}"
                save_object(
                    obj_id=article_id,
                    obj_type="Article",
                    properties={"title": title, "body": output_data, "source_url": "https://example.com/competitor"},
                    lifecycle="Collected",
                    owner="test-brand"
                )
                add_relation(task_id, article_id, "produces")
                
                outputs["research_summary"] = output_data

            elif model == "claude":
                # Deep Analysis -> Knowledge Nodes (Pain Point, Desire, Offer, CTA, Pattern)
                card = {
                    "title": title,
                    "summary": "分析競品銷售頁中的漏斗設計與誘餌策略，提煉出核心受眾的痛點與情感訴求。",
                    "key_themes": ["價值階梯", "高價諮詢", "行銷漏斗", "受眾痛點"],
                    "target_audience": {
                        "profile": "知識型創業家、諮詢顧問與企業負責人，現狀為工作時間長但利潤微薄。",
                        "pain_points": [
                            "花費大量時間售賣低單價線上課程，導致體力透支",
                            "缺乏系統化的高票價後端產品設計",
                            "廣告成本居高不下，缺乏自然流量渠道"
                        ]
                    },
                    "emotional_triggers": ["對低利潤的焦慮感", "渴望時間自由與商業體系化", "希望服務高品質客戶的成就感"],
                    "key_claims": [
                        "賣高價諮詢並非難在銷售，而是難在自信心與價值階梯設計。",
                        "高價服務可以大幅降低客戶管理成本，並提供 10 倍的服務成效。"
                    ],
                    "hooks": [
                        "你還在靠賣 $990 的線上課貼補家用嗎？這就是你無法做大的原因！",
                        "如何只服務 5 位頂級客戶，就超越你過去一整年的課程營收？"
                    ],
                    "cta": "預約 15 分鐘高價值事業診斷電話"
                }
                
                # Save as Knowledge Nodes
                for idx, pp in enumerate(card["target_audience"]["pain_points"]):
                    pp_id = f"pain_point_{task_id}_{idx}"
                    save_object(pp_id, "Pain Point", {"description": pp}, "Analyzed", "test-brand")
                    add_relation(f"article_{task_id}", pp_id, "reveals")
                    
                cta_id = f"cta_{task_id}"
                save_object(cta_id, "CTA", {"phrase": card["cta"]}, "Analyzed", "test-brand")
                add_relation(f"article_{task_id}", cta_id, "uses_cta")
                
                pattern_id = f"pattern_{task_id}"
                save_object(pattern_id, "Pattern", {"formulas": card["hooks"]}, "Analyzed", "test-brand")
                add_relation(cta_id, pattern_id, "links_to")
                
                outputs["analysis_card"] = card

            elif model == "chatgpt":
                # Creative Copy -> Content Object & Quiz Object & Decision Object
                assets = {
                    "brand_translation": "將競品漏斗概念轉譯至 Erick 的 ABL 能量定位框架。重點不在於『如何賣昂貴產品』，而在於『如何透過 ABL 能量狀態調頻，建立高頻磁場吸引夢想客戶』，進而無痛成交高階諮詢。",
                    "facebook_post": f"🚀 【低價產品正在悄悄綁架你的生活嗎？】 🚀\n\n你是否每天忙到半夜，只為了賣出一堂 $990 的小課？\n這不是在做生意，這是在給自己打一份超長工時的低薪工！\n\nErick 在實踐 ABL 能量調整系統中發現：\n👉 賣一堂 $50,000 的高階能量諮詢，其實比賣 50 堂小課更省力、更精準！\n\n📌 在下方留言「調頻」，我送你【高價事業能量調頻手冊】！\n\n#個人品牌 #ABL系統 #行銷漏斗 #高價諮詢 #狀態調頻",
                    "short_video_script": "【Reels 短影音腳本：為什麼高價比低價更好賣？】\n\n[0-3s 痛點 Hook]\n旁白：『每天加班 14 小時賣便宜課？你是在創業還是自虐？』\n\n[45-60s CTA]\n旁白：『點擊我頭像，私訊「高價」，我把完整的能量價值階梯表格發給你！』",
                    "call_to_action": "私訊粉專留言「高價」，立即索取價值階梯能量對照表！",
                    "quiz_questions": [
                        {
                            "question": "Erick ABL 系統中，高票價成交的首要前提是什麼？",
                            "options": [
                                "A. 降價促銷",
                                "B. 寫出上萬字的長文案",
                                "C. 調整個人能量狀態至巔峰 (ABL調頻)",
                                "D. 投放百萬廣告費"
                            ],
                            "answer": "C. 調整個人能量狀態至巔峰 (ABL調頻)"
                        }
                    ]
                }
                
                content_id = f"content_{task_id}"
                save_object(content_id, "Content", assets, "Draft", "test-brand")
                add_relation(task_id, content_id, "generates")
                add_relation("test-brand", content_id, "owns")
                
                # Save computed score object
                score_id = f"score_{task_id}"
                save_object(score_id, "Score", {"opportunity_score": 88.5, "roi_score": 92.0}, "Calculated", "test-brand")
                add_relation(content_id, score_id, "evaluated_by")
                
                outputs["brand_translation"] = assets["brand_translation"]
                outputs["facebook_post"] = assets["facebook_post"]
                outputs["short_video_script"] = assets["short_video_script"]
                outputs["call_to_action"] = assets["call_to_action"]
                outputs["quiz_questions"] = assets["quiz_questions"]

            elif model == "codex":
                # Local test runner output
                test_output = "Assertions passed: 5/5. Heuristic syntax checks completed successfully."
                outputs["test_report"] = test_output

            elif model == "cowork":
                # Knowledge Hub sync -> Knowledge Node & Memory Object
                sync_msg = f"Synced insights of '{title}' into Knowledge base."
                outputs["publish_log"] = sync_msg
                
                # Update long-term memory node
                mem_id = f"memory_insight_{task_id}"
                save_object(
                    obj_id=mem_id,
                    obj_type="Memory",
                    properties={"type": "long_term", "insight": f"Pain point resolved for brand test-brand via high-ticket positioning"},
                    lifecycle="Active",
                    owner="test-brand"
                )
                add_relation("test-brand", mem_id, "remembers")
                
                # Write to shared KB file
                kb_path = os.path.join(self.base_dir, "storage", "knowledge_base.md")
                with open(kb_path, "a", encoding="utf-8") as kb_f:
                    kb_f.write(f"\n## [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {title}\n- Synced Insight: {sync_msg}\n")

            step_order += 1
            
        return outputs
