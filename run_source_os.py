import sys
import os
import uuid
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(__file__))

from src.database import init_db, save_object, get_object, get_objects_by_type, add_relation
from src.orchestrator.models import Category, Source, Brand
from src.orchestrator.discovery import SourceDiscoveryEngine
from src.orchestrator.scoring import SourceScoreEngine
from src.orchestrator.auto_discovery import AutoDiscovery
from src.orchestrator.graph import KnowledgeGraph
from src.orchestrator.decision import DecisionEngine
from src.orchestrator.classifier import TaskClassifier
from src.orchestrator.router import ModelRouter
from src.orchestrator.runner import MockRunner

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
    """Initializes DB, default categories and default brand metadata."""
    init_db()
    # Init default categories if empty
    if not Category.get_all():
        discoverer = AutoDiscovery()
        discoverer.init_default_categories()
    
    # Init default brand metadata if empty
    if not Brand.get("test-brand"):
        Brand.create(
            brand_id="test-brand",
            name="Erick Brand Ecosystem",
            positioning="High-ticket consulting and personal growth state adjustment (ABL)",
            audience="Entrepreneurs, knowledge creators, coaching experts",
            products=[
                {"name": "High-Ticket Consulting Masterclass", "price": 990},
                {"name": "ABL Private Coaching", "price": 50000}
            ],
            tone="Empowerment, high-energy, direct-response",
            region="Global",
            language="zh-TW",
            source_ids=[],
            status="Active"
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
    
    # Locate category ID
    categories = Category.get_all()
    cat_id = None
    for cat in categories:
        if cat["properties"]["name"].lower() == category_name.lower() or cat["id"].lower() == category_name.lower().replace(" ", "_"):
            cat_id = cat["id"]
            break
            
    if not cat_id:
        # Fallback category creation or slug name
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
        # Save as Candidate in DB
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
            tier="Tier 4"
        )
        print(f"  - [{cand['source_type']}] {cand['name']} -> Saved as {source_id} (Candidate)")

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
        
        # Threshold for promotion: overall_source_score >= 30.0 (Tier 3 or above)
        if overall_score >= 30.0:
            Source.promote_to_active(s["id"])
            
            # Associate default brand test-brand
            source_obj = Source.get(s["id"])
            if source_obj:
                sprops = source_obj["properties"]
                sprops["brand_id"] = "test-brand"
                sprops["owner"] = "test-brand"
                save_object(s["id"], "Source", sprops, "Active", "test-brand")
                
                add_relation("test-brand", s["id"], "owns_source")
                add_relation(s["id"], "test-brand", "associated_brand")
                
                # Update Brand Metadata source list
                brand_obj = Brand.get("test-brand")
                if brand_obj:
                    bprops = brand_obj["properties"]
                    s_ids = bprops.get("source_ids", [])
                    if s["id"] not in s_ids:
                        s_ids.append(s["id"])
                    Brand.create(
                        brand_id="test-brand",
                        name=bprops["name"],
                        positioning=bprops["positioning"],
                        audience=bprops["audience"],
                        products=bprops["products"],
                        tone=bprops["tone"],
                        region=bprops["region"],
                        language=bprops["language"],
                        source_ids=s_ids,
                        status=bprops["status"]
                    )
            
            # Emit promote events
            evt_id = f"event_promoted_{uuid.uuid4().hex[:8]}"
            save_object(
                obj_id=evt_id,
                obj_type="Event",
                properties={"event_type": "source_promoted_to_registry", "source_id": s["id"], "name": props["name"]},
                lifecycle="Emitted",
                owner="system"
            )
            print(f"  - {C_GREEN}Promoted:{C_END} {props['name']} (Score: {overall_score}) associated with Brand test-brand")
            promoted_count += 1
        else:
            # Reject
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
            print(f"  * {C_BOLD}{s['id']}{C_END}: {props.get('name')} ({props.get('source_type')}) | Score: {C_GREEN}{props.get('overall_source_score')}{C_END} | Brand: {props.get('brand_id')}")

def run_daily_workflow():
    print_header("Running Daily Source-Centric Workflow")
    
    # 1. Run Auto Discovery
    print(f"1. {C_BOLD}Running Auto Discovery...{C_END}")
    discoverer = AutoDiscovery()
    disco_res = discoverer.run_daily_workflow("test-brand")
    print(f"   - Categories read: {disco_res['categories_read']}")
    print(f"   - Candidates discovered: {disco_res['candidates_found']}")
    print(f"   - Promoted to registry: {len(disco_res['promoted_sources'])}")
    print(f"   - Events emitted: {len(disco_res['events_emitted'])}")
    print(f"   - KG contains_source relations written: {disco_res['kg_links_written']}")
    
    # Fetch top active source
    sources = Source.get_all()
    active_sources = [s for s in sources if s["lifecycle"] == "Active"]
    if not active_sources:
        print(f"{C_RED}No active sources found to run intelligence on.{C_END}")
        return
        
    top_source = sorted(active_sources, key=lambda x: x["properties"].get("overall_source_score", 0.0), reverse=True)[0]
    top_source_id = top_source["id"]
    top_source_name = top_source["properties"]["name"]
    top_category_id = top_source["properties"]["category_id"]
    
    print(f"\nTop Active Source Selected for Intelligence: {C_GREEN}{top_source_name}{C_END} (Score: {top_source['properties']['overall_source_score']})")
    
    # 2. Run Capability Orchestrator for Content Analysis
    print(f"\n2. {C_BOLD}Dispatching Task to AI Capability Orchestrator...{C_END}")
    task_desc = f"請分析來源 {top_source_name} 的最新高票價行銷策略與痛點，並轉譯為 Erick ABL 品牌的 FB 貼文與短影音腳本。"
    
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
    print(f"   - Task Classifier matched capabilities: {C_GREEN}{classification['required_capabilities']}{C_END}")
    
    router = ModelRouter()
    route_info = router.route(classification['required_capabilities'])
    print(f"   - Model Router sequence: {' ➔ '.join([m.upper() for m in route_info['route_sequence']])}")
    
    runner = MockRunner()
    outputs = runner.execute_route(task_id, route_info['route_sequence'], task_desc)
    print(f"   {C_GREEN}✔ Orchestrator mock pipeline execution completed!{C_END}")
    
    # Fetch decision
    decision_engine = DecisionEngine()
    decisions = decision_engine.generate_recommendations("test-brand")
    
    # Write events for daily workflows
    save_object(f"event_collected_{task_id}", "Event", {"event_type": "content_collected", "source_id": top_source_id}, "Emitted", "system")
    save_object(f"event_analyzed_{task_id}", "Event", {"event_type": "intelligence_analyzed", "source_id": top_source_id}, "Emitted", "system")
    save_object(f"event_asset_{task_id}", "Event", {"event_type": "content_asset_created", "source_id": top_source_id}, "Emitted", "system")
    save_object(f"event_decision_{task_id}", "Event", {"event_type": "decision_generated"}, "Emitted", "system")

    # 3. Create semantic nodes and trace relations in Knowledge Graph
    # Category -> Source (already contains_source link in AutoDiscovery)
    # Source -> Content
    content_id = f"content_{task_id}"
    KnowledgeGraph.create_node(content_id, "Content", {"title": f"Transcribed content from {top_source_name}", "body": outputs.get("facebook_post")})
    KnowledgeGraph.create_edge(top_source_id, content_id, "produces_content")
    
    # Content -> Pattern
    pattern_id = f"pattern_{task_id}" # created in MockRunner
    KnowledgeGraph.create_edge(content_id, pattern_id, "links_to_pattern")
    
    # Pattern -> Decision
    decision_id = [d["id"] for d in get_objects_by_type("Decision")][0] # Fetch latest decision ID
    KnowledgeGraph.create_edge(pattern_id, decision_id, "leads_to_decision")
    
    print(f"\n3. {C_BOLD}Knowledge Graph Relations Synced:{C_END}")
    print(f"   Category ({top_category_id}) ➔ Source ({top_source_id}) ➔ Content ({content_id}) ➔ Pattern ({pattern_id}) ➔ Decision ({decision_id})")
    
    print(f"\n{C_BOLD}{C_GREEN}✔ Daily Source-Centric Workflow executed successfully!{C_END}\n")

def print_daily_decision():
    print_header("Daily Strategic Decision Output")
    decision_engine = DecisionEngine()
    dec = decision_engine.generate_recommendations("test-brand")
    
    print(f"🎯 {C_BOLD}今天最值得追蹤的 Source:{C_END} {C_GREEN}{dec['today_top_source']}{C_END}")
    print(f"📝 {C_BOLD}今天最值得分析的 Content:{C_END} {dec['today_top_content']}")
    print(f"💡 {C_BOLD}今天最值得寫的 Topic:{C_END} {C_YELLOW}{dec['today_top_topic']}{C_END}")
    print(f"🎬 {C_BOLD}今天最適合產出的 Content Format:{C_END} {dec['today_top_format']}")
    print(f"🛡 {C_BOLD}建議理由:{C_END} {dec['reason']}")
    print(f"📈 {C_BOLD}Confidence Score:{C_END} {C_GREEN}{dec['confidence_score'] * 100}%{C_END}")
    
    print(f"\n{C_BOLD}今日推薦 Topic Top 5:{C_END}")
    for item in dec["today_top_5"]:
        print(f"  [{item['priority']}] Rank {item['rank']}: {item['topic']} (Conf: {item['confidence'] * 100}%)")
        print(f"    - Reason: {item['reason']}")
        
    print(f"\n{C_BOLD}本月行銷 Campaign 主題:{C_END} {C_PURPLE}{dec['monthly_campaign']['theme']}{C_END}")
    for g in dec['monthly_campaign']['campaign_goals']:
        print(f"  - 目標: {g}")
    print()

def main():
    init_system()
    
    if len(sys.argv) < 2:
        print(f"{C_BOLD}{C_RED}Error: Please specify a command flag.{C_END}")
        print("Usage:")
        print("  python3 run_source_os.py --list-categories")
        print("  python3 run_source_os.py --discover \"<Category Name>\"")
        print("  python3 run_source_os.py --score-sources")
        print("  python3 run_source_os.py --promote-sources")
        print("  python3 run_source_os.py --list-sources")
        print("  python3 run_source_os.py --run-daily")
        print("  python3 run_source_os.py --daily-decision")
        sys.exit(1)
        
    flag = sys.argv[1]
    
    if flag == "--list-categories":
        list_categories()
    elif flag == "--discover":
        if len(sys.argv) < 3:
            print(f"{C_RED}Error: Please specify the category name. E.g. python3 run_source_os.py --discover \"Women's Growth\"{C_END}")
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
