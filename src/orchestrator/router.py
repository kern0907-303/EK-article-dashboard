import os
import json
from .registry import AgentRegistry

class ModelRouter:
    def __init__(self):
        self.registry_mgr = AgentRegistry()

    def route(self, required_capabilities: list) -> dict:
        """
        Determines the optimal AI models path, estimates cost/tokens, and explains suitability.
        Queries profiles dynamically from the SQLite Agent database.
        """
        # Load all agents from registry
        all_agents = self.registry_mgr.get_all_agents()
        agents_map = {a["id"]: a["properties"] for a in all_agents}
        
        suitable_models = {}
        excluded_models = {}
        model_assignments = {}
        
        # 1. Match required capabilities to the best model using scoring heuristics
        for cap in required_capabilities:
            best_model = None
            highest_score = -1
            
            for m_id, m_profile in agents_map.items():
                if cap in m_profile.get("capabilities", []):
                    score = 0
                    # Prefer local/free models first
                    if m_profile.get("token_cost", {}).get("input_per_1m", 0.0) == 0.0:
                        score += 10
                    
                    # Heuristics matching optimal capabilities
                    if m_id == "gemini" and cap in ["scraping", "retrieval", "summarization"]:
                        score += 5
                    elif m_id == "claude" and cap in ["deep_analysis", "pain_point_extraction", "coding"]:
                        score += 5
                    elif m_id == "chatgpt" and cap in ["copywriting", "brand_translation", "interactive_quiz", "cta_generation"]:
                        score += 5
                    elif m_id == "codex" and cap in ["syntax_check", "unit_test_run"]:
                        score += 5
                    elif m_id == "cowork" and cap in ["kb_sync"]:
                        score += 5
                        
                    if score > highest_score:
                        highest_score = score
                        best_model = m_id
                        
            if best_model:
                model_assignments[cap] = best_model

        # Build dynamic sequence of model steps
        step_priority = {
            "gemini": 1,
            "claude": 2,
            "chatgpt": 3,
            "codex": 4,
            "cowork": 5
        }
        
        assigned_models = set(model_assignments.values())
        route_sequence = sorted(list(assigned_models), key=lambda x: step_priority.get(x, 10))

        # Build suitability and exclusion lists
        for m_id, m_profile in agents_map.items():
            intersection = set(required_capabilities).intersection(set(m_profile.get("capabilities", [])))
            if intersection:
                suitable_models[m_id] = {
                    "model_name": m_profile.get("model_name"),
                    "reason": f"擁有所需能力：{list(intersection)}。在該模型優勢中表現卓越：{m_profile.get('strengths')}",
                    "assigned_capabilities": [c for c, m in model_assignments.items() if m == m_id]
                }
            else:
                excluded_models[m_id] = {
                    "model_name": m_profile.get("model_name"),
                    "reason": "任務所需的任何能力皆不符合該模型的專長標籤。"
                }

        # Token & Cost Estimation
        step_costs = []
        total_tokens = 0
        total_cost = 0.0
        
        token_standards = {
            "gemini": {"input": 4000, "output": 1500},
            "claude": {"input": 1500, "output": 1000},
            "chatgpt": {"input": 1000, "output": 2000},
            "codex": {"input": 500, "output": 500},
            "cowork": {"input": 1000, "output": 200}
        }

        for model in route_sequence:
            profile = agents_map[model]
            std = token_standards.get(model, {"input": 1000, "output": 1000})
            
            in_cost = (std["input"] / 1_000_000) * profile.get("token_cost", {}).get("input_per_1m", 0.0)
            out_cost = (std["output"] / 1_000_000) * profile.get("token_cost", {}).get("output_per_1m", 0.0)
            step_cost = in_cost + out_cost
            
            step_costs.append({
                "model_id": model,
                "model_name": profile.get("model_name"),
                "input_tokens": std["input"],
                "output_tokens": std["output"],
                "cost_usd": step_cost
            })
            
            total_tokens += std["input"] + std["output"]
            total_cost += step_cost

        # Cost comparison calculation vs all-Claude route
        claude_profile = agents_map.get("claude", {})
        claude_in_price = claude_profile.get("token_cost", {}).get("input_per_1m", 3.0)
        claude_out_price = claude_profile.get("token_cost", {}).get("output_per_1m", 15.0)
        
        all_claude_cost = ((total_tokens * 0.6) / 1_000_000 * claude_in_price) + ((total_tokens * 0.4) / 1_000_000 * claude_out_price)
        savings_percentage = ((all_claude_cost - total_cost) / all_claude_cost) * 100 if all_claude_cost > 0 else 0.0

        gemini_in_price = agents_map.get("gemini", {}).get("token_cost", {}).get("input_per_1m", 0.075)
        chatgpt_in_price = agents_map.get("chatgpt", {}).get("token_cost", {}).get("input_per_1m", 0.15)

        cost_rationale = (
            f"本路徑針對各處理階段挑選性價比最優模型。第一步使用 Gemini Flash 擷取大量資料（單價僅 ${gemini_in_price}/1M），"
            f"第二步僅將核心乾淨 Markdown 傳送給 Claude 做高精度的痛點分析，"
            f"第三步使用低單價且擅長社群寫作的 ChatGPT-mini 生成最終文案（單價 ${chatgpt_in_price}/1M），"
            f"最後由本地免費的 Cowork 進行同步。若本工作流全部使用高成本的 Claude Sonnet 完成，預估成本約為 ${all_claude_cost:.5f} USD，"
            f"採用此動態調配路徑僅需 ${total_cost:.5f} USD，節省了高達 {savings_percentage:.1f}% 的 API 預算。"
        )

        return {
            "route_sequence": route_sequence,
            "suitable_models": suitable_models,
            "excluded_models": excluded_models,
            "step_costs": step_costs,
            "total_tokens": total_tokens,
            "total_cost": total_cost,
            "cost_rationale": cost_rationale
        }
