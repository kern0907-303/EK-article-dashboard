import json
from datetime import datetime
from ..database import save_object, get_object, get_objects_by_type, add_relation, get_relations

class Category:
    @staticmethod
    def create(category_id: str, name: str, description: str, keywords: list,
               target_audience: str, region: str, language: str, priority: str, status: str = "Active") -> bool:
        properties = {
            "name": name,
            "description": description,
            "keywords": keywords,
            "target_audience": target_audience,
            "region": region,
            "language": language,
            "priority": priority,
            "status": status,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        return save_object(
            obj_id=category_id,
            obj_type="Category",
            properties=properties,
            lifecycle=status,
            owner="system"
        )

    @staticmethod
    def get(category_id: str) -> dict:
        return get_object(category_id)

    @staticmethod
    def get_all() -> list:
        return get_objects_by_type("Category")


class Source:
    @staticmethod
    def create(source_id: str, name: str, category_id: str, brand_id: str = None, owner: str = None,
               source_type: str = "Website", country: str = "US", language: str = "en", url: str = "",
               rss_url: str = "", youtube_channel: str = "", facebook_page: str = "", instagram: str = "",
               threads: str = "", podcast: str = "", newsletter: str = "", update_frequency: str = "weekly",
               authority_score: float = 0.0, traffic_score: float = 0.0, seo_score: float = 0.0,
               engagement_score: float = 0.0, conversion_score: float = 0.0, quality_score: float = 0.0,
               overall_source_score: float = 0.0, tier: str = "Tier 4", status: str = "Candidate",
               is_mock: bool = True, source_confidence: str = "simulated", url_status: str = "unverified") -> bool:
        
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        properties = {
            "name": name,
            "category_id": category_id,
            "brand_id": brand_id,
            "owner": owner,
            "source_type": source_type,
            "country": country,
            "language": language,
            "url": url,
            "rss_url": rss_url,
            "youtube_channel": youtube_channel,
            "facebook_page": facebook_page,
            "instagram": instagram,
            "threads": threads,
            "podcast": podcast,
            "newsletter": newsletter,
            "update_frequency": update_frequency,
            "authority_score": authority_score,
            "traffic_score": traffic_score,
            "seo_score": seo_score,
            "engagement_score": engagement_score,
            "conversion_score": conversion_score,
            "quality_score": quality_score,
            "overall_source_score": overall_source_score,
            "tier": tier,
            "status": status,
            "created_at": now_str,
            "updated_at": now_str,
            "is_mock": is_mock,
            "source_confidence": source_confidence,
            "url_status": url_status
        }
        
        saved = save_object(
            obj_id=source_id,
            obj_type="Source",
            properties=properties,
            lifecycle=status,
            owner=brand_id or "system"
        )
        if saved:
            # Link Category -> Source
            add_relation(category_id, source_id, "contains_source")
            # Link Brand -> Source if present
            if brand_id:
                add_relation(brand_id, source_id, "owns_source")
                add_relation(source_id, brand_id, "associated_brand")
        return saved

    @staticmethod
    def update_scores_and_tier(source_id: str, scores: dict) -> bool:
        source_obj = Source.get(source_id)
        if not source_obj:
            return False
        
        props = source_obj["properties"]
        for k, v in scores.items():
            props[k] = v
        props["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # update state and overall tier
        status = props.get("status", "Candidate")
        return save_object(
            obj_id=source_id,
            obj_type="Source",
            properties=props,
            lifecycle=status,
            owner=props.get("brand_id") or "system"
        )

    @staticmethod
    def promote_to_active(source_id: str) -> bool:
        source_obj = Source.get(source_id)
        if not source_obj:
            return False
        props = source_obj["properties"]
        props["status"] = "Active"
        props["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return save_object(
            obj_id=source_id,
            obj_type="Source",
            properties=props,
            lifecycle="Active",
            owner=props.get("brand_id") or "system"
        )

    @staticmethod
    def get(source_id: str) -> dict:
        return get_object(source_id)

    @staticmethod
    def get_all() -> list:
        return get_objects_by_type("Source")


class Brand:
    @staticmethod
    def create(brand_id: str, name: str, positioning: str, audience: str,
               products: list, tone: str, region: str, language: str,
               source_ids: list, status: str = "Active") -> bool:
        properties = {
            "name": name,
            "positioning": positioning,
            "audience": audience,
            "products": products,
            "tone": tone,
            "region": region,
            "language": language,
            "source_ids": source_ids,
            "status": status,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        return save_object(
            obj_id=brand_id,
            obj_type="Brand",
            properties=properties,
            lifecycle=status,
            owner=brand_id
        )

    @staticmethod
    def get(brand_id: str) -> dict:
        return get_object(brand_id)

    @staticmethod
    def get_all() -> list:
        return get_objects_by_type("Brand")


class Asset:
    @staticmethod
    def create(asset_id: str, brand: str, topic: str, keywords: list, campaign: str,
               product: str, content_type: str, publish_date: str = None, status: str = "Published",
               performance: dict = None, ctr: float = 0.0, conversion: float = 0.0, reuse_score: float = 0.0) -> bool:
        
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        properties = {
            "brand": brand,
            "topic": topic,
            "keywords": keywords,
            "campaign": campaign,
            "product": product,
            "content_type": content_type,
            "publish_date": publish_date or now_str.split(" ")[0],
            "status": status,
            "performance": performance or {},
            "ctr": ctr,
            "conversion": conversion,
            "reuse_score": reuse_score,
            "last_updated": now_str
        }
        return save_object(
            obj_id=asset_id,
            obj_type="Asset",
            properties=properties,
            lifecycle=status,
            owner=brand
        )

    @staticmethod
    def get(asset_id: str) -> dict:
        return get_object(asset_id)

    @staticmethod
    def get_all() -> list:
        return get_objects_by_type("Asset")
