import sys
import os
import uuid
import json
from datetime import datetime

from src.database import get_db_connection, init_db, save_object, get_object, get_objects_by_type, add_relation
from src.orchestrator.classifier import TaskClassifier
from src.orchestrator.router import ModelRouter
from src.orchestrator.runner import MockRunner
from src.orchestrator.models import Brand, Source

# ANSI Color codes for premium CLI styling
C_GREEN = "\033[92m"
C_CYAN = "\033[96m"
C_YELLOW = "\033[93m"
C_PURPLE = "\033[95m"
C_RED = "\033[91m"
C_BOLD = "\033[1m"
C_END = "\033[0m"

def print_header(title):
    print(f"\n{C_BOLD}{C_PURPLE}=== {title} ==={C_END}")

def register_default_brand():
    """Registers the default brand using the frozen v4 Brand Registry schema."""
    Brand.create(
        brand_id="test-brand",
        name="Erick Personal Brand",
        positioning="High-ticket sales, state adjustment, direct-response.",
        target_audience="Entrepreneurs, high-performers, creators.",
        products=[
            {"name": "High Ticket Masterclass", "price": 990},
            {"name": "ABL Private Coaching", "price": 50000}
        ],
        tone_of_voice="Inspiring, energetic, direct-response",
        forbidden_words=["cheap", "discount", "low cost"],
        prompts={"methodology": "ABL state adjustment alignment before copywriting"},
        methodology="ABL (Align, Balance, Launch)",
        score_weights={"opportunity": 0.3, "trend": 0.25, "roi": 0.45}
    )

def simulate_decision_engine() -> dict:
    """Mock Decision Engine calculation output."""
    decisions = {
        "today_top_5": [
            {"rank": 1, "topic": "ABL 能量調頻：成交高票價的核心祕訣", "priority": "P0", "impact": "high", "confidence": 0.95, "reason": "市場痛點得分極高，與品牌核心 ABL 契合度 100%"},
            {"rank": 2, "topic": "為什麼賣 $990 的線上課是慢性自殺？", "priority": "P0", "impact": "high", "confidence": 0.92, "reason": "高轉化痛點，切中受眾精力耗盡的痛點"},
            {"rank": 3, "topic": "如何用 Russell Brunson 的價值階梯重新包裝諮詢服務", "priority": "P1", "impact": "medium", "confidence": 0.88, "reason": "價值階梯概念在市場搜尋量上升中"},
            {"rank": 4, "topic": "能量磁場調頻：在文案撰寫前做這三件事", "priority": "P1", "impact": "medium", "confidence": 0.85, "reason": "微調頻教學能有效增長自然互動"},
            {"rank": 5, "topic": "Dream 100 實戰指南：找到你夢想客戶的流量池", "priority": "P2", "impact": "low", "confidence": 0.80, "reason": "補充型長青內容，適合長線布局"}
        ],
        "weekly_top_10": [
            {"topic": "從零開始做 $50,000 的高階諮詢定位", "priority": "P0", "confidence": 0.94},
            {"topic": "Erick ABL 系統與個人能量定位的底層邏輯", "priority": "P1", "confidence": 0.89}
        ],
        "monthly_campaign": {
            "theme": "破局低價：重構你的高票價商業價值階梯",
            "campaign_goals": ["吸引 20 位潛在高階諮詢意向者", "完成 5 場 ABL 直播公開課"]
        }
    }
    return decisions

def simulate_feedback_loop():
    """Simulates the closed feedback loop on CLI: Ingestion -> Learning -> Next Decision."""
    print_header("Feedback Loop Simulation")
    print(f"📡 {C_BOLD}Event Ingested:{C_END} {C_GREEN}'analytics_received'{C_END}")
    print(f"  - Target Asset: {C_BOLD}content_test-brand-facebook_post{C_END}")
    print(f"  - Metrics Captured: CTR = {C_GREEN}5.2%{C_END} (Benchmark = 2.0%), Views = {C_BOLD}15,000{C_END}, Conversions = {C_GREEN}12{C_END}")
    
    print(f"\n🧠 {C_BOLD}Learning Engine In Action:{C_END}")
    print("  - Analytics indicate that content matching theme '高票價定位' performs 2.6x above benchmark.")
    print("  - Action: Optimizing Brand score weights vector in SQLite objects registry...")
    
    # Read current weights
    brand = Brand.get("test-brand")
    orig_weights = brand["properties"].get("score_weights", {})
    
    # Calibrate weights
    new_weights = {
        "opportunity": round(orig_weights.get("opportunity", 0.3) + 0.05, 2),
        "trend": orig_weights.get("trend", 0.25),
        "roi": round(orig_weights.get("roi", 0.45) + 0.05, 2)
    }
    
    # Save back to database
    brand["properties"]["score_weights"] = new_weights
    save_object(brand["id"], "Brand", brand["properties"], brand["lifecycle"], brand["owner"])
    
    print(f"  - Weights Adjusted: {C_YELLOW}{orig_weights}{C_END} ➔ {C_GREEN}{new_weights}{C_END}")
    print(f"  - SQLite Object Updated: {C_BOLD}objects.id = 'test-brand'{C_END}")
    
    print(f"\n🎯 {C_BOLD}Decision Engine Recalculation:{C_END}")
    print("  - Recalculating Today's Top 5 Recommendations based on calibrated weights...")
    
    updated_decisions = simulate_decision_engine()
    # Boost P0 rank 1 confidence
    updated_decisions["today_top_5"][0]["confidence"] = 0.98
    updated_decisions["today_top_5"][0]["reason"] += " (依據成效反饋，該主題吸引力權重調高)"
    
    print(f"\n{C_BOLD}Updated Today's Top 5:{C_END}")
    for item in updated_decisions["today_top_5"]:
        print(f"  [{item['priority']}] Rank {item['rank']}: {item['topic']} (Confidence: {C_GREEN}{item['confidence']}{C_END})")
        print(f"    - Reason: {item['reason']}")
        
    print(f"\n{C_BOLD}{C_GREEN}✔ Closed-Loop Feedback Simulation completed!{C_END}\n")

def generate_handoff_file(task_id: str, task_desc: str, classification: dict, route_info: dict, outputs: dict, decisions: dict) -> str:
    base_dir = os.path.dirname(__file__)
    handoff_dir = os.path.join(base_dir, "storage")
    os.makedirs(handoff_dir, exist_ok=True)
    
    file_path = os.path.join(handoff_dir, f"handoff_{task_id}.md")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(f"# Brand Intelligence OS - Handoff Report (Frozen v4 Schema)\n\n")
        f.write(f"- **Task ID**: `{task_id}`\n")
        f.write(f"- **Generation Time**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- **Task Type**: {classification['task_type']}\n\n")
        
        f.write(f"## 1. Original Request\n")
        f.write(f"> {task_desc}\n\n")
        
        f.write(f"## 2. Dynamic Route Sequence\n")
        route_str = " ➔ ".join([m.upper() for m in route_info['route_sequence']])
        f.write(f"`{route_str}`\n\n")
        
        f.write(f"## 3. Cost & Token Summary\n")
        f.write(f"- **Total Tokens**: {route_info['total_tokens']}\n")
        f.write(f"- **Total Estimated Cost**: ${route_info['total_cost']:.5f} USD\n")
        f.write(f"- **Optimization Rationale**: {route_info['cost_rationale']}\n\n")
        
        f.write(f"## 4. Decision Engine recommendations\n")
        f.write(f"### Today's Top 5\n")
        for item in decisions["today_top_5"]:
            f.write(f"1. **[{item['priority']}] Rank {item['rank']}**: {item['topic']} (Confidence: {item['confidence']})\n")
            f.write(f"   - *Reason*: {item['reason']}\n")
        f.write(f"\n### Monthly Campaign\n")
        f.write(f"- **Theme**: {decisions['monthly_campaign']['theme']}\n")
        for g in decisions['monthly_campaign']['campaign_goals']:
            f.write(f"  - Goal: {g}\n")
        f.write("\n")
        
        f.write(f"## 5. Execution Output Artifacts\n\n")
        
        if "research_summary" in outputs:
            f.write(f"### [GEMINI] Research Summary\n")
            f.write(f"{outputs['research_summary']}\n\n")
            
        if "analysis_card" in outputs:
            f.write(f"### [CLAUDE] Analysis Intelligence Card\n")
            f.write(f"```json\n{json.dumps(outputs['analysis_card'], ensure_ascii=False, indent=2)}\n```\n\n")
            
        if "brand_translation" in outputs:
            f.write(f"### [CHATGPT] Brand Translation\n")
            f.write(f"> {outputs['brand_translation']}\n\n")
            
        if "facebook_post" in outputs:
            f.write(f"### [CHATGPT] Facebook Post\n")
            f.write(f"```text\n{outputs['facebook_post']}\n```\n\n")
            
        if "short_video_script" in outputs:
            f.write(f"### [CHATGPT] Short Video Script\n")
            f.write(f"```text\n{outputs['short_video_script']}\n```\n\n")
            
        if "call_to_action" in outputs:
            f.write(f"### [CHATGPT] Call to Action\n")
            f.write(f"- {outputs['call_to_action']}\n\n")
            
        if "quiz_questions" in outputs:
            f.write(f"### [CHATGPT] Social Quiz Questions\n")
            for idx, q in enumerate(outputs['quiz_questions']):
                f.write(f"{idx+1}. **{q['question']}**\n")
                for opt in q['options']:
                    f.write(f"   - {opt}\n")
                f.write(f"   - *Correct Answer*: {q['answer']}\n\n")
                
        if "test_report" in outputs:
            f.write(f"### [CODEX] Local Unit Test Report\n")
            f.write(f"```text\n{outputs['test_report']}\n```\n\n")
            
        if "publish_log" in outputs:
            f.write(f"### [COWORK] Knowledge Base Sync Log\n")
            f.write(f"- {outputs['publish_log']}\n")
            
    return file_path

def main():
    # Make sure DB schema is ready
    init_db()
    
    # Sync agent registry & brand configuration
    register_default_brand()
    
    # Command argument triggers
    if len(sys.argv) > 1 and sys.argv[1] == "--feedback":
        simulate_feedback_loop()
        sys.exit(0)
        
    if len(sys.argv) > 1:
        task_desc = sys.argv[1]
    else:
        task_desc = "幫我分析一篇競品銷售頁，萃取痛點、CTA，並轉成 Erick 品牌的 FB 貼文與短影音腳本。"
        
    print(f"\n{C_BOLD}{C_CYAN}🤖 Starting Brand Intelligence OS MVP CLI (v4 Frozen Architecture)...{C_END}")
    print(f"{C_BOLD}Prompt Received:{C_END} \"{task_desc}\"\n")
    
    task_id = str(uuid.uuid4())
    
    # 1. TASK CLASSIFICATION
    classifier = TaskClassifier()
    classification = classifier.classify(task_desc)
    
    print_header("1. Task Classification")
    print(f"- {C_BOLD}Task Type:{C_END} {classification['task_type']}")
    print(f"- {C_BOLD}Required Capabilities:{C_END} {C_GREEN}{classification['required_capabilities']}{C_END}")
    print(f"- {C_BOLD}Estimated Tokens:{C_END} {classification['token_estimate']}")
    print(f"- {C_BOLD}Difficulty:{C_END} {classification['difficulty']}")
    
    # Save Task Object
    save_object(
        obj_id=task_id,
        obj_type="Task",
        properties={
            "description": task_desc,
            "task_type": classification["task_type"],
            "required_capabilities": classification["required_capabilities"]
        },
        lifecycle="Created",
        owner="system"
    )
    
    # 2. MODEL ROUTER
    router = ModelRouter()
    route_info = router.route(classification['required_capabilities'])
    
    print_header("2. Capability Match")
    print(f"{C_BOLD}Suitable Agents:{C_END}")
    for m_id, detail in route_info['suitable_models'].items():
        print(f"  {C_GREEN}✔ {m_id.upper()}{C_END} ({detail['model_name']})")
        print(f"    - Assigned Caps: {detail['assigned_capabilities']}")
        print(f"    - Rationale: {detail['reason']}")
        
    print(f"\n{C_BOLD}Excluded Agents:{C_END}")
    for m_id, detail in route_info['excluded_models'].items():
        print(f"  {C_RED}✖ {m_id.upper()}{C_END} ({detail['model_name']})")
        print(f"    - Rationale: {detail['reason']}")
        
    # 3. MODEL ROUTE
    print_header("3. Model Route Plan")
    route_str = " ➔ ".join([f"{C_BOLD}{C_YELLOW}{m.upper()}{C_END}" for m in route_info['route_sequence']])
    print(f"Dynamic Path: {route_str}")
    
    # 4. COST / TOKEN ESTIMATE
    print_header("4. Cost & Token Estimate")
    print(f"- {C_BOLD}Total Token Count:{C_END} {route_info['total_tokens']}")
    print(f"- {C_BOLD}Estimated Cost:{C_END} {C_GREEN}${route_info['total_cost']:.5f} USD{C_END}")
    print(f"\n{C_BOLD}Step-by-Step Breakdown:{C_END}")
    for step in route_info['step_costs']:
        print(f"  - {step['model_id'].upper()}: {step['input_tokens']} in / {step['output_tokens']} out | ${step['cost_usd']:.5f} USD")
    print(f"\n{C_BOLD}Cost Rationale:{C_END}\n{route_info['cost_rationale']}")
    
    # 5. DECISION ENGINE OUTPUT
    decisions = simulate_decision_engine()
    print_header("5. Decision Engine recommendations")
    print(f"{C_BOLD}Today's Top 5:{C_END}")
    for item in decisions["today_top_5"]:
        print(f"  [{item['priority']}] Rank {item['rank']}: {item['topic']} (Confidence: {C_GREEN}{item['confidence']}{C_END})")
        print(f"    - Reason: {item['reason']}")
    print(f"\n{C_BOLD}Monthly Campaign Theme:{C_END} {C_YELLOW}{decisions['monthly_campaign']['theme']}{C_END}")
    
    # Save Decision Object in SQLite Objects store
    save_object(
        obj_id=f"decision_{task_id}",
        obj_type="Decision",
        properties=decisions,
        lifecycle="Active",
        owner="test-brand"
    )
    add_relation(task_id, f"decision_{task_id}", "leads_to")
    
    # 6. MOCK EXECUTION OUTPUT
    print_header("6. Mock Execution Outputs")
    runner = MockRunner()
    try:
        outputs = runner.execute_route(task_id, route_info['route_sequence'], task_desc)
        print(f"\n{C_GREEN}✔ All steps completed successfully!{C_END}")
        
        # Show preview of outputs
        if "research_summary" in outputs:
            print(f"\n--- [GEMINI] Research Summary (Preview) ---")
            print("\n".join(outputs['research_summary'].splitlines()[:5]) + "\n...")
        if "analysis_card" in outputs:
            print(f"\n--- [CLAUDE] Analysis Intelligence Card (Preview) ---")
            print(json.dumps(outputs['analysis_card'], ensure_ascii=False, indent=2)[:300] + "\n...")
        if "facebook_post" in outputs:
            print(f"\n--- [CHATGPT] Facebook Post (Preview) ---")
            print("\n".join(outputs['facebook_post'].splitlines()[:6]) + "\n...")
        if "quiz_questions" in outputs:
            print(f"\n--- [CHATGPT] Interactive Quiz Questions ---")
            print(json.dumps(outputs['quiz_questions'], ensure_ascii=False, indent=2))
        if "publish_log" in outputs:
            print(f"\n--- [COWORK] Sync Status ---")
            print(outputs['publish_log'])
            
        # 7. FINAL HANDOFF FILE
        print_header("7. Final Handoff")
        handoff_path = generate_handoff_file(task_id, task_desc, classification, route_info, outputs, decisions)
        print(f"{C_GREEN}Handoff markdown report successfully generated at:{C_END}")
        print(f"👉 [handoff_{task_id}.md](file://{handoff_path})")
        
        # Update Task Lifecycle to Completed
        save_object(task_id, "Task", classification, "Completed", "system")
        print(f"\n{C_BOLD}{C_GREEN}=== Brand Intelligence OS MVP Pipeline Done ==={C_END}\n")
        
    except Exception as e:
        print(f"\n{C_RED}✖ Execution failed: {e}{C_END}")
        save_object(task_id, "Task", classification, "Failed", "system")
        sys.exit(1)

if __name__ == "__main__":
    main()
