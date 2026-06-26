import uuid
from datetime import datetime
from .models import Category, Source, Brand
from .discovery import SourceDiscoveryEngine
from .scoring import SourceScoreEngine
from .graph import KnowledgeGraph
from ..database import save_object, add_relation

class AutoDiscovery:
    def __init__(self):
        self.discovery_engine = SourceDiscoveryEngine()
        self.score_engine = SourceScoreEngine()

    def run_daily_workflow(self, brand_id: str = "test-brand") -> dict:
        """
        Runs the daily discovery, scoring, promotion, and graph linkage workflow.
        """
        results = {
            "categories_read": 0,
            "candidates_found": 0,
            "promoted_sources": [],
            "events_emitted": [],
            "kg_links_written": 0
        }

        # 1. Read Category Registry
        categories = Category.get_all()
        results["categories_read"] = len(categories)

        # If no categories, load defaults
        if not categories:
            self.init_default_categories()
            categories = Category.get_all()
            results["categories_read"] = len(categories)

        # 2. Discover & Score for each Category
        for cat in categories:
            cat_id = cat["id"]
            
            # Search candidates
            candidates = self.discovery_engine.discover_candidates(cat_id)
            results["candidates_found"] += len(candidates)
            
            # Process each candidate
            for cand in candidates:
                source_id = cand["source_id"]
                name = cand["name"]
                
                # Emit source_candidate_found event
                cand_found_event_id = f"event_cand_found_{uuid.uuid4().hex[:8]}"
                save_object(
                    obj_id=cand_found_event_id,
                    obj_type="Event",
                    properties={"event_type": "source_candidate_found", "source_id": source_id, "name": name},
                    lifecycle="Emitted",
                    owner="system"
                )
                results["events_emitted"].append("source_candidate_found")
                
                # 3. Create Candidate Source
                Source.create(
                    source_id=source_id,
                    name=name,
                    category_id=cat_id,
                    brand_id=None, # Brand linked after scoring/promotion
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
                
                # 4. Execute Source Scoring & Tier Assignment
                scores = self.score_engine.calculate_source_score(cand)
                
                # Save scored event
                scored_event_id = f"event_scored_{uuid.uuid4().hex[:8]}"
                save_object(
                    obj_id=scored_event_id,
                    obj_type="Event",
                    properties={"event_type": "source_scored", "source_id": source_id, "name": name, "overall_score": scores["overall_source_score"]},
                    lifecycle="Emitted",
                    owner="system"
                )
                results["events_emitted"].append("source_scored")
                
                # Update candidate source with calculated scores and tier in DB
                Source.update_scores_and_tier(source_id, scores)
                
                # 5 & 6. Promote to Source Registry if overall score >= 30.0 (Threshold: Tier 3 and above)
                overall_score = scores["overall_source_score"]
                if overall_score >= 30.0:
                    Source.promote_to_active(source_id)
                    results["promoted_sources"].append(source_id)
                    
                    # Promote event
                    promote_event_id = f"event_promoted_{uuid.uuid4().hex[:8]}"
                    save_object(
                        obj_id=promote_event_id,
                        obj_type="Event",
                        properties={"event_type": "source_promoted_to_registry", "source_id": source_id, "name": name},
                        lifecycle="Emitted",
                        owner="system"
                    )
                    results["events_emitted"].append("source_promoted_to_registry")
                    
                    # 7. Automatically build Brand Metadata association (if relevant)
                    # We link to the default brand if the relevance score is high (e.g. >= 50.0)
                    if scores.get("authority_score", 0) >= 50.0 and brand_id:
                        source_obj = Source.get(source_id)
                        if source_obj:
                            props = source_obj["properties"]
                            props["brand_id"] = brand_id
                            props["owner"] = brand_id
                            save_object(source_id, "Source", props, "Active", brand_id)
                            
                            # Link relation
                            add_relation(brand_id, source_id, "owns_source")
                            add_relation(source_id, brand_id, "associated_brand")
                            
                            # Update brand metadata's source_ids list
                            brand_obj = Brand.get(brand_id)
                            if brand_obj:
                                brand_props = brand_obj["properties"]
                                s_ids = brand_props.get("source_ids", [])
                                if source_id not in s_ids:
                                    s_ids.append(source_id)
                                brand_props["source_ids"] = s_ids
                                Brand.create(
                                    brand_id=brand_id,
                                    name=brand_props["name"],
                                    positioning=brand_props["positioning"],
                                    audience=brand_props["audience"],
                                    products=brand_props["products"],
                                    tone=brand_props["tone"],
                                    region=brand_props["region"],
                                    language=brand_props["language"],
                                    source_ids=s_ids,
                                    status=brand_props["status"]
                                )
                    
                    # 8. Emit source_discovered event
                    discovered_event_id = f"event_discovered_{uuid.uuid4().hex[:8]}"
                    save_object(
                        obj_id=discovered_event_id,
                        obj_type="Event",
                        properties={"event_type": "source_discovered", "source_id": source_id, "name": name},
                        lifecycle="Emitted",
                        owner="system"
                    )
                    results["events_emitted"].append("source_discovered")
                    
                    # 9. Write to Knowledge Graph relations
                    # Create KG link Category -> Source
                    KnowledgeGraph.create_edge(cat_id, source_id, "contains_source")
                    results["kg_links_written"] += 1
                else:
                    # Rejected event
                    reject_event_id = f"event_rejected_{uuid.uuid4().hex[:8]}"
                    save_object(
                        obj_id=reject_event_id,
                        obj_type="Event",
                        properties={"event_type": "source_rejected", "source_id": source_id, "name": name},
                        lifecycle="Emitted",
                        owner="system"
                    )
                    results["events_emitted"].append("source_rejected")

        return results

    def init_default_categories(self):
        """Registers the 25 specified categories into the database."""
        default_categories = [
            ("womens_growth", "Women's Growth", "Empowerment, leadership and growth for women.", ["women", "growth", "empowerment"]),
            ("personal_development", "Personal Development", "Self improvement, mindset, and habits.", ["mindset", "habits", "improvement"]),
            ("leadership", "Leadership", "Executive training, management, and leading teams.", ["management", "executive", "influence"]),
            ("business", "Business", "Entrepreneurship, strategy, and business models.", ["strategy", "startup", "scale"]),
            ("marketing", "Marketing", "Direct response, funnel scaling, and copywriting.", ["funnel", "conversion", "copywriting"]),
            ("ai", "AI", "Artificial intelligence, machine learning, and automation.", ["ml", "llm", "automation"]),
            ("psychology", "Psychology", "Cognitive psychology, behavior design, and persuasion.", ["behavior", "persuasion", "mental"]),
            ("health", "Health", "Physical health, nutrition, and fitness.", ["fitness", "nutrition", "strength"]),
            ("wellness", "Wellness", "Mental wellness, stress reduction, and balance.", ["balance", "meditation", "mindful"]),
            ("numerology", "Numerology", "Life path numbers, birthday analysis, and destiny.", ["lifepath", "destiny", "numbers"]),
            ("spiritual", "Spiritual", "Spiritual alignment, energy tuning, and frequency.", ["energy", "alignment", "frequency"]),
            ("enterprise", "Enterprise", "B2B sales, corporate operations, and large scale growth.", ["b2b", "corporate", "sales"]),
            ("coaching", "Coaching", "Coaching methodologies, high-ticket consulting, and guidance.", ["consulting", "guidance", "mentor"]),
            ("education", "Education", "Teaching, instruction, and learning theory.", ["teaching", "learning", "pedagogy"]),
            ("course_creator", "Course Creator", "Online course creation, content packaging, and LMS.", ["teachable", "lms", "curriculum"]),
            ("publisher", "Publisher", "Book publishing, newsletters, and print media.", ["book", "media", "print"]),
            ("media", "Media", "Digital media, news reporting, and broadcast.", ["news", "broadcast", "digital"]),
            ("community", "Community", "Community building, forums, and membership programs.", ["skool", "membership", "forum"]),
            ("podcast", "Podcast", "Audio show production, guest interviews, and distribution.", ["audio", "spotify", "episodes"]),
            ("youtube_creator", "YouTube Creator", "Video content creation, channel growth, and vlogging.", ["video", "youtube", "vlog"]),
            ("finance", "Finance", "Personal finance, budgeting, and wealth management.", ["wealth", "budget", "saving"]),
            ("investment", "Investment", "Stock market, real estate, and portfolio speculation.", ["trading", "stocks", "speculation"]),
            ("productivity", "Productivity", "Time management, focus, and workflow automation.", ["focus", "time", "workflow"]),
            ("decision_making", "Decision Making", "Heuristics, biases, and strategic choice framing.", ["choice", "biases", "rational"]),
            ("organization_development", "Organization Development", "Culture building, hiring, and scaling org capacity.", ["culture", "hiring", "scaling"])
        ]
        
        for c_id, name, desc, keywords in default_categories:
            Category.create(
                category_id=c_id,
                name=name,
                description=desc,
                keywords=keywords,
                target_audience="General audience interested in " + name,
                region="Global",
                language="en",
                priority="Medium",
                status="Active"
            )
