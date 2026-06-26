from .plugins import PluginManager
from .models import Brand
from ..database import save_object, add_relation

class ScoringEngine:
    def __init__(self):
        self.plugin_mgr = PluginManager()

    def calculate_topic_score(self, brand_id: str, topic_id: str, topic_metrics: dict) -> float:
        """
        Executes active Score Plugins and aggregates them using Brand weights.
        Saves computed metrics as a Score Object in SQLite.
        """
        # 1. Fetch Brand weights
        brand_obj = Brand.get(brand_id)
        weights = {}
        if brand_obj:
            weights = brand_obj["properties"].get("score_weights", {})
            
        # Fallbacks for weights
        w_opp = weights.get("opportunity", 0.3)
        w_gap = weights.get("trend", 0.3) # use trend weight for gap/trend scoring
        w_roi = weights.get("roi", 0.4)
        
        # 2. Instantiate and calculate plugin scores
        opp_plugin = self.plugin_mgr.get_plugin_instance("opportunity_scorer")
        gap_plugin = self.plugin_mgr.get_plugin_instance("gap_scorer")
        roi_plugin = self.plugin_mgr.get_plugin_instance("roi_scorer")
        
        opp_val = opp_plugin.calculate(topic_metrics) if opp_plugin else 0.0
        gap_val = gap_plugin.calculate(topic_metrics) if gap_plugin else 0.0
        roi_val = roi_plugin.calculate(topic_metrics) if roi_plugin else 0.0
        
        # Normalize and aggregate
        # Max scores for Opp/Gap/ROI are roughly 100
        weighted_score = round(
            (opp_val * w_opp) + (gap_val * w_gap) + (roi_val * w_roi),
            2
        )
        
        # 3. Save Score Object
        score_id = f"score_{topic_id}"
        save_object(
            obj_id=score_id,
            obj_type="Score",
            properties={
                "opportunity": opp_val,
                "gap": gap_val,
                "roi": roi_val,
                "weighted_score": weighted_score,
                "weights_used": {"opp": w_opp, "gap": w_gap, "roi": w_roi}
            },
            lifecycle="Calculated",
            owner=brand_id
        )
        # Link topic to score
        add_relation(topic_id, score_id, "evaluated_by")
        
        return weighted_score
