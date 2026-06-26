from ..database import save_object, get_object, get_objects_by_type, add_relation, get_relations

class Brand:
    @staticmethod
    def create(brand_id: str, name: str, positioning: str, target_audience: str, 
               products: list, tone_of_voice: str, forbidden_words: list, 
               prompts: dict, methodology: str, score_weights: dict) -> bool:
        properties = {
            "name": name,
            "positioning": positioning,
            "target_audience": target_audience,
            "products": products,
            "tone_of_voice": tone_of_voice,
            "forbidden_words": forbidden_words,
            "prompts": prompts,
            "methodology": methodology,
            "score_weights": score_weights
        }
        return save_object(
            obj_id=brand_id,
            obj_type="Brand",
            properties=properties,
            lifecycle="Active",
            owner=brand_id
        )

    @staticmethod
    def get(brand_id: str) -> dict:
        return get_object(brand_id)

    @staticmethod
    def get_all() -> list:
        return get_objects_by_type("Brand")


class Source:
    @staticmethod
    def create(source_id: str, brand_id: str, source_type: str, 
               plugin_name: str, source_url: str, config: dict) -> bool:
        properties = {
            "source_type": source_type,
            "plugin_name": plugin_name,
            "source_url": source_url,
            "config": config
        }
        # Save Source Object
        saved = save_object(
            obj_id=source_id,
            obj_type="Source",
            properties=properties,
            lifecycle="Active",
            owner=brand_id
        )
        if saved:
            # Add relationship link: Brand --owns--> Source
            add_relation(
                source_id=brand_id,
                target_id=source_id,
                relation_type="owns",
                properties={"description": f"Brand owns source feed: {source_url}"}
            )
        return saved

    @staticmethod
    def get(source_id: str) -> dict:
        return get_object(source_id)

    @staticmethod
    def get_all() -> list:
        return get_objects_by_type("Source")
