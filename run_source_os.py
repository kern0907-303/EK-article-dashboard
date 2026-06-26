import sys
import os
import uuid
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(__file__))

from src.database import init_db, save_object, get_object, get_objects_by_type, add_relation
from src.orchestrator.models import Category, Source, Brand, Asset
from src.orchestrator.discovery import SourceDiscoveryEngine
from src.orchestrator.scoring import SourceScoreEngine
from src.orchestrator.auto_discovery import AutoDiscovery
from src.orchestrator.graph import KnowledgeGraph
from src.orchestrator.decision import DecisionEngine
from src.orchestrator.classifier import TaskClassifier
from src.orchestrator.router import ModelRouter
from src.orchestrator.runner import MockRunner
from src.orchestrator.guardrail import BrandGuardrail

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

def init_system():
    """Initializes DB, default categories and default brand metadata with V2 strategy properties."""
    init_db()
    # Init default categories if empty
    if not Category.get_all():
        discoverer = AutoDiscovery()
        discoverer.init_default_categories()
    
    # Init default brand metadata if empty
    if not Brand.get("test-brand"):
        properties = {
            "name": "Erick Brand Ecosystem",
            "positioning": "High-ticket consulting and personal growth state adjustment (ABL)",
            "audience": "Entrepreneurs, knowledge creators, coaching experts",
            "products": [
                {"name": "High-Ticket Consulting Masterclass", "price": 990},
                {"name": "ABL Private Coaching", "price": 50000}
            ],
            "tone": "Empowerment, high-energy, direct-response",
            "region": "Global",
            "language": "zh-TW",
            "source_ids": [],
            "status": "Active",
            "current_product_focus": "人生承接力",
            "target_audience_segments": ["35~55 女性", "創業者", "企業主", "CEO"],
            "current_campaign": "打破消耗：中年女性的狀態調整與穩定方案"
        }
        save_object(
            obj_id="test-brand",
            obj_type="Brand",
            properties=properties,
            lifecycle="Active",
            owner="test-brand"
        )

def list_categories():
    print_header("Category Registry Listing")
    categories = Category.get_all()
    print(f"Total categories registered: {len(categories)}")
    for cat in categories:
        props = cat["properties"]
        print(f"- {C_BOLD}{cat['id']}{C_END}: {props.get('name')} | Priority: {props.get('priority')} | Status: {props.get('status')}")

def discover_sources(category_name: str):
    print_header(f"Source Discovery for Category: {category_name}")
    
    categories = Category.get_all()
    cat_id = None
    for cat in categories:
        if cat["properties"]["name"].lower() == category_name.lower() or cat["id"].lower() == category_name.lower().replace(" ", "_"):
            cat_id = cat["id"]
            break
            
    if not cat_id:
        cat_id = category_name.lower().replace("'", "").replace(" ", "_")
        Category.create(
            category_id=cat_id,
            name=category_name,
            description="Dynamically created category",
            keywords=[],
            target_audience="Generic",
            region="Global",
            language="en",
            priority="Medium",
            status="Active"
        )
        print(f"Created category node: {cat_id}")

    discoverer = SourceDiscoveryEngine()
    candidates = discoverer.discover_candidates(cat_id)
    print(f"Found {C_GREEN}{len(candidates)}{C_END} candidates:")
    
    for cand in candidates:
        source_id = cand["source_id"]
        Source.create(
            source_id=source_id,
            name=cand["name"],
            category_id=cat_id,
            brand_id=None,
            owner="system",
            source_type=cand["source_type"],
            country=cand["country"],
            language=cand["language"],
            url=cand["url"],
            rss_url=cand["rss_url"],
            youtube_channel=cand["youtube_channel"],
            facebook_page=cand["facebook_page"],
            instagram=cand["instagram"],
            threads=cand["threads"],
            podcast=cand["podcast"],
            newsletter=cand["newsletter"],
            update_frequency=cand["update_frequency"],
            authority_score=cand["authority_score"],
            traffic_score=cand["traffic_score"],
            status="Candidate",
            tier="Tier 4",
            is_mock=cand["is_mock"],
            source_confidence=cand["source_confidence"],
            url_status=cand["url_status"]
        )
        print(f"  - [{cand['source_type']}] {cand['name']} -> Saved as {source_id} (Candidate) [Mock: {cand['is_mock']} | Conf: {cand['source_confidence']} | URL: {cand['url_status']}]")

def score_sources():
    print_header("Source Scoring Pipeline")
    sources = Source.get_all()
    candidates = [s for s in sources if s["lifecycle"] == "Candidate"]
    print(f"Total candidates to score: {len(candidates)}")
    
    scorer = SourceScoreEngine()
    for s in candidates:
        props = s["properties"]
        scores = scorer.calculate_source_score(props)
        Source.update_scores_and_tier(s["id"], scores)
        print(f"  - Scored {s['id']} ({props['name']}): Overall Score = {C_GREEN}{scores['overall_source_score']}{C_END} -> Tier: {C_YELLOW}{scores['tier']}{C_END}")

def promote_sources():
    print_header("Source Promotion (Registry Join)")
    sources = Source.get_all()
    candidates = [s for s in sources if s["lifecycle"] == "Candidate"]
    
    promoted_count = 0
    for s in candidates:
        props = s["properties"]
        overall_score = props.get("overall_source_score", 0.0)
        
        if overall_score >= 30.0:
            Source.promote_to_active(s["id"])
            
            source_obj = Source.get(s["id"])
            if source_obj:
                sprops = source_obj["properties"]
                sprops["brand_id"] = "test-brand"
                sprops["owner"] = "test-brand"
                save_object(s["id"], "Source", sprops, "Active", "test-brand")
                
                add_relation("test-brand", s["id"], "owns_source")
                add_relation(s["id"], "test-brand", "associated_brand")
                
                brand_obj = Brand.get("test-brand")
                if brand_obj:
                    bprops = brand_obj["properties"]
                    s_ids = bprops.get("source_ids", [])
                    if s["id"] not in s_ids:
                        s_ids.append(s["id"])
                    
                    bprops["source_ids"] = s_ids
                    save_object("test-brand", "Brand", bprops, bprops.get("status", "Active"), "test-brand")
            
            evt_id = f"event_promoted_{uuid.uuid4().hex[:8]}"
            save_object(
                obj_id=evt_id,
                obj_type="Event",
                properties={"event_type": "source_promoted_to_registry", "source_id": s["id"], "name": props["name"]},
                lifecycle="Emitted",
                owner="system"
            )
            print(f"  - {C_GREEN}Promoted:{C_END} {props['name']} (Score: {overall_score}) [Mock: {props.get('is_mock')} | URL Status: {props.get('url_status')}]")
            promoted_count += 1
        else:
            reject_evt_id = f"event_rejected_{uuid.uuid4().hex[:8]}"
            save_object(
                obj_id=reject_evt_id,
                obj_type="Event",
                properties={"event_type": "source_rejected", "source_id": s["id"], "name": props["name"]},
                lifecycle="Emitted",
                owner="system"
            )
            print(f"  - Rejected: {props['name']} (Score: {overall_score} too low)")
            
    print(f"Promotion completed. {promoted_count} sources promoted to Registry.")

def list_sources():
    print_header("Source Registry Listing (Tiers)")
    sources = Source.get_all()
    active_sources = [s for s in sources if s["lifecycle"] == "Active"]
    
    tiers = {"Tier 1": [], "Tier 2": [], "Tier 3": [], "Tier 4": []}
    for s in active_sources:
        tier = s["properties"].get("tier", "Tier 4")
        if tier in tiers:
            tiers[tier].append(s)
            
    for tier_name in ["Tier 1", "Tier 2", "Tier 3", "Tier 4"]:
        print(f"\n{C_BOLD}{C_CYAN}--- {tier_name} ({len(tiers[tier_name])} Sources) ---{C_END}")
        for s in tiers[tier_name]:
            props = s["properties"]
            print(f"  * {C_BOLD}{s['id']}{C_END}: {props.get('name')} ({props.get('source_type')}) | Score: {C_GREEN}{props.get('overall_source_score')}{C_END} | Mock: {props.get('is_mock')} | URL: {props.get('url_status')}")

def run_daily_workflow():
    print_header("Running Daily Source-Centric Workflow")
    
    # 1. Run Auto Discovery
    print(f"1. {C_BOLD}Running Auto Discovery...{C_END}")
    discoverer = AutoDiscovery()
    disco_res = discoverer.run_daily_workflow("test-brand")
    print(f"   - Categories read: {disco_res['categories_read']}")
    print(f"   - Candidates discovered: {disco_res['candidates_found']}")
    print(f"   - Promoted to registry: {len(disco_res['promoted_sources'])}")
    
    # Fetch top active source
    sources = Source.get_all()
    active_sources = [s for s in sources if s["lifecycle"] == "Active"]
    if not active_sources:
        print(f"{C_RED}No active sources found to run intelligence on.{C_END}")
        return
        
    top_source = sorted(active_sources, key=lambda x: x["properties"].get("overall_source_score", 0.0), reverse=True)[0]
    top_source_id = top_source["id"]
    top_source_name = top_source["properties"]["name"]
    
    print(f"\nTop Active Source Selected: {C_GREEN}{top_source_name}{C_END} (Score: {top_source['properties']['overall_source_score']}) [Mock: {top_source['properties'].get('is_mock')} | Conf: {top_source['properties'].get('source_confidence')}]")
    
    # 2. Run Capability Orchestrator for Content Analysis
    print(f"\n2. {C_BOLD}Dispatching Task to AI Capability Orchestrator...{C_END}")
    task_desc = f"請爬取並分析來源網頁 {top_source_name} 的行銷與心態策略，並轉譯為 Erick ABL 品牌的 FB 貼文，並同步到知識庫。"
    
    task_id = f"task_{uuid.uuid4().hex[:8]}"
    save_object(
        obj_id=task_id,
        obj_type="Task",
        properties={"description": task_desc, "source_id": top_source_id},
        lifecycle="Created",
        owner="system"
    )
    
    classifier = TaskClassifier()
    classification = classifier.classify(task_desc)
    
    router = ModelRouter()
    route_info = router.route(classification['required_capabilities'])
    
    runner = MockRunner()
    outputs = runner.execute_route(task_id, route_info['route_sequence'], task_desc)
    print(f"   {C_GREEN}✔ Orchestrator mock pipeline completed!{C_END}")
    
    # Fetch decision
    decision_engine = DecisionEngine()
    dec = decision_engine.generate_recommendations("test-brand")
    
    # Write events
    save_object(f"event_collected_{task_id}", "Event", {"event_type": "content_collected", "source_id": top_source_id}, "Emitted", "system")
    save_object(f"event_analyzed_{task_id}", "Event", {"event_type": "intelligence_analyzed", "source_id": top_source_id}, "Emitted", "system")

    # 3. Create semantic nodes in KG
    content_id = f"content_{task_id}"
    KnowledgeGraph.create_node(content_id, "Content", {"title": f"Transcribed content from {top_source_name}", "body": outputs.get("facebook_post")})
    KnowledgeGraph.create_edge(top_source_id, content_id, "produces_content")
    
    pattern_id = f"pattern_{task_id}"
    KnowledgeGraph.create_edge(content_id, pattern_id, "links_to_pattern")
    
    dec_objects = get_objects_by_type("Decision")
    decision_id = dec_objects[0]["id"] if dec_objects else "decision_fallback"
    KnowledgeGraph.create_edge(pattern_id, decision_id, "leads_to_decision")
    
    print(f"\n3. {C_BOLD}Knowledge Graph Traversal Edge Synced.{C_END}")
    print(f"   ✔ Daily Source-Centric Workflow executed successfully!")
    print_daily_intelligence_report(dec)

def print_daily_intelligence_report(dec=None):
    if not dec:
        decision_engine = DecisionEngine()
        dec = decision_engine.generate_recommendations("test-brand")
        
    print_header("DAILY INTELLIGENCE REPORT")
    
    # 1. New Sources
    print(f"\n{C_BOLD}1. NEW SOURCES (Ingested & Scored Today):{C_END}")
    sources = Source.get_all()
    active_sources = [s for s in sources if s["lifecycle"] == "Active"]
    if active_sources:
        for s in active_sources[:5]:
            props = s["properties"]
            print(f"  - [{props.get('tier', 'Tier 4')}] {C_BOLD}{props.get('name')}{C_END} ({props.get('source_type')}) | Score: {C_GREEN}{props.get('overall_source_score')}{C_END} | Verified: {not props.get('is_mock', True) or props.get('url_status') == 'verified'}")
    else:
        print("  - No new active sources registered today.")
        
    # 2. New Contents
    print(f"\n{C_BOLD}2. NEW CONTENTS (Collected via Gemini):{C_END}")
    from src.database import get_objects_by_type
    articles = get_objects_by_type("Article")
    if articles:
        latest_art = articles[-1]
        props = latest_art["properties"]
        print(f"  - Title: {C_CYAN}{props.get('title')}{C_END}")
        body = props.get("body", "")
        snippet = "\n".join([line for line in body.splitlines() if line.strip()][:5])
        print(f"  - Content Excerpt:\n{snippet}\n    ...")
    else:
        print("  - No new contents ingested today.")
        
    # 3. Top 5 Intelligence
    print(f"\n{C_BOLD}3. TOP 5 INTELLIGENCE (Extracted via Claude):{C_END}")
    pain_points = get_objects_by_type("Pain Point")
    ctas = get_objects_by_type("CTA")
    patterns = get_objects_by_type("Pattern")
    
    intel_count = 0
    if pain_points:
        for pp in pain_points[-3:]:
            print(f"  - [Pain Point] {pp['properties'].get('description')}")
            intel_count += 1
    if ctas:
        print(f"  - [CTA] Phrase: {C_PURPLE}{ctas[-1]['properties'].get('phrase')}{C_END}")
        intel_count += 1
    if patterns:
        formulas = patterns[-1]['properties'].get('formulas', [])
        if formulas:
            print(f"  - [Pattern] Formula Hook: {formulas[0]}")
            intel_count += 1
            
    if intel_count == 0:
        print("  - No intelligence extraction nodes found in graph.")
        
    # 4. Top 3 Recommended Topics
    print(f"\n{C_BOLD}4. TOP 3 RECOMMENDED TOPICS:{C_END}")
    rec_topics = dec.get("recommended_topics", [])
    if rec_topics:
        for idx, item in enumerate(rec_topics[:3]):
            print(f"  * {C_BOLD}Rank {idx+1}: {item['topic']}{C_END}")
            print(f"    - Format: {C_CYAN}{item['content_type']}{C_END} | CTA: {C_PURPLE}{item['cta']}{C_END}")
            print(f"    - Score: {C_GREEN}{item['final_score']}{C_END} | Confidence: {item['confidence']*100}%")
    else:
        print("  - No topics passed the sequential filtering pipeline today.")
        
    # 5. Rejected Topics
    print(f"\n{C_BOLD}5. REJECTED TOPICS & REASONS:{C_END}")
    rej_topics = dec.get("rejected_topics", [])
    if rej_topics:
        for item in rej_topics:
            print(f"  ✖ {C_RED}{item['topic']}{C_END}")
            print(f"    - Reason: {C_YELLOW}{item['reason']}{C_END}")
    else:
        print("  - No topics were rejected by filters today.")
    print()

def print_daily_decision():
    print_header("Daily Strategic Decision Output")
    decision_engine = DecisionEngine()
    dec = decision_engine.generate_recommendations("test-brand")
    
    print(f"🎯 {C_BOLD}今天最值得追蹤的 Source:{C_END} {C_GREEN}{dec['today_top_source']}{C_END}")
    print(f"📡 {C_BOLD}Source Reality Check:{C_END}")
    print(f"  - Is Mock Source: {C_YELLOW}{dec['is_mock']}{C_END}")
    print(f"  - Source Confidence: {C_YELLOW}{dec['source_confidence']}{C_END}")
    print(f"  - URL status: {C_YELLOW}{dec['url_status']}{C_END}")
    print(f"  - Verified source conclusion: {'Verified' if dec['source_verified'] else 'Unverified / Simulated'}")
    
    print(f"\n🚀 {C_BOLD}Strategy Alignments (V3 System):{C_END}")
    print(f"  - Current Focus Product: {C_GREEN}{dec['current_product_focus']}{C_END}")
    print(f"  - Target Audience Segments: {C_GREEN}{dec['target_audience_segments']}{C_END}")
    print(f"  - Active Campaign theme: {C_GREEN}{dec['current_campaign']}{C_END}")

    print(f"\n🛡 {C_BOLD}Brand Guardrail Status:{C_END}")
    print(f"  - Passed Brand Guardrail: {'Yes' if dec['passed_brand_guardrail'] else 'No (Forbidden words detected and rewritten)'}")
    if not dec["passed_brand_guardrail"]:
        print(f"  - Original Metaphysical Topic: {C_RED}{dec['original_topic']}{C_END}")
        print(f"  - Rewritten Brand-Compliant Topic: {C_GREEN}{dec['rewritten_topic']}{C_END}")
        
    print(f"\n💡 {C_BOLD}今天最值得寫的 Topic (最終推薦):{C_END} {C_GREEN}{dec['today_top_topic']}{C_END}")
    print(f"🎬 {C_BOLD}今天最適合產出的 Content Format:{C_END} {C_GREEN}{dec['today_top_format']}{C_END}")
    print(f"📝 {C_BOLD}今天最值得分析的 Content:{C_END} {dec['today_top_content']}")
    print(f"📈 {C_BOLD}Confidence Score:{C_END} {C_GREEN}{dec['confidence_score'] * 100}%{C_END}")
    print(f"💬 {C_BOLD}建議理由:{C_END} {dec['reason']}")
    
    # Also print the Daily Intelligence Report
    print_daily_intelligence_report(dec)

    print(f"\n{C_BOLD}本月行銷 Campaign 主題:{C_END} {C_PURPLE}{dec['monthly_campaign']['theme']}{C_END}")
    for g in dec['monthly_campaign']['campaign_goals']:
        print(f"  - 目標: {g}")
    print()

def main():
    init_system()
    
    if len(sys.argv) < 2:
        print(f"{C_BOLD}{C_RED}Error: Please specify a command flag.{C_END}")
        sys.exit(1)
        
    flag = sys.argv[1]
    
    if flag == "--list-categories":
        list_categories()
    elif flag == "--discover":
        if len(sys.argv) < 3:
            print(f"{C_RED}Error: Please specify category name.{C_END}")
            sys.exit(1)
        discover_sources(sys.argv[2])
    elif flag == "--score-sources":
        score_sources()
    elif flag == "--promote-sources":
        promote_sources()
    elif flag == "--list-sources":
        list_sources()
    elif flag == "--run-daily":
        run_daily_workflow()
    elif flag == "--daily-decision":
        print_daily_decision()
    else:
        print(f"{C_RED}Unknown command: {flag}{C_END}")
        sys.exit(1)

if __name__ == "__main__":
    main()
