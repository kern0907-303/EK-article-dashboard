import uuid
from datetime import datetime
from .models import Brand
from ..database import save_object, add_relation

class LearningEngine:
    def process_analytics_feedback(self, brand_id: str, content_id: str, ctr: float, conversions: int) -> dict:
        """
        Ingests performance metrics (CTR, conversions).
        If metrics exceed benchmark, calibrates Brand weights dynamically.
        Saves changes to the brand object and logs a Feedback Event.
        """
        benchmark_ctr = 2.0
        
        # Fetch current brand configuration
        brand = Brand.get(brand_id)
        if not brand:
            return {}
            
        orig_weights = brand["properties"].get("score_weights", {"opportunity": 0.3, "trend": 0.3, "roi": 0.4})
        
        # Calculate delta
        delta = ctr - benchmark_ctr
        adjusted = False
        new_weights = orig_weights.copy()
        
        if delta > 0:
            # CTR is high, boost weights for opportunity and ROI dynamically
            new_weights["opportunity"] = round(orig_weights.get("opportunity", 0.3) + 0.05, 2)
            new_weights["roi"] = round(orig_weights.get("roi", 0.4) + 0.05, 2)
            adjusted = True
            
            # Save updated brand properties back to DB
            brand["properties"]["score_weights"] = new_weights
            save_object(
                obj_id=brand_id,
                obj_type="Brand",
                properties=brand["properties"],
                lifecycle=brand["lifecycle"],
                owner=brand["owner"]
            )
            
            # 3. Log Feedback Event Object
            event_id = f"feedback_event_{str(uuid.uuid4())[:8]}"
            save_object(
                obj_id=event_id,
                obj_type="Event",
                properties={
                    "event_type": "weight_adjusted",
                    "content_id": content_id,
                    "ctr_received": ctr,
                    "conversions": conversions,
                    "old_weights": orig_weights,
                    "new_weights": new_weights,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                },
                lifecycle="Completed",
                owner=brand_id
            )
            add_relation(brand_id, event_id, "learned_from")
            
        return {
            "adjusted": adjusted,
            "old_weights": orig_weights,
            "new_weights": new_weights
        }
