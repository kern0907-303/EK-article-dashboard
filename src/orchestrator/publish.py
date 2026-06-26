import uuid
from datetime import datetime
from ..database import save_object, get_object, add_relation

class PublishCenter:
    @staticmethod
    def submit_for_review(content_id: str) -> bool:
        content = get_object(content_id)
        if content:
            return save_object(
                obj_id=content_id,
                obj_type="Content",
                properties=content["properties"],
                lifecycle="Pending",
                owner=content["owner"]
            )
        return False

    @staticmethod
    def approve_asset(content_id: str) -> bool:
        content = get_object(content_id)
        if content:
            # Change state to Approved
            success = save_object(
                obj_id=content_id,
                obj_type="Content",
                properties=content["properties"],
                lifecycle="Approved",
                owner=content["owner"]
            )
            if success:
                # Log publish details
                log_id = f"publish_log_{str(uuid.uuid4())[:8]}"
                save_object(
                    obj_id=log_id,
                    obj_type="Event",
                    properties={
                        "event_type": "asset_published",
                        "content_id": content_id,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "status": "success",
                        "message": "Simulated posting to Facebook Page API completed."
                    },
                    lifecycle="Published",
                    owner=content["owner"]
                )
                add_relation(content_id, log_id, "logs")
            return success
        return False

    @staticmethod
    def reject_asset(content_id: str) -> bool:
        content = get_object(content_id)
        if content:
            return save_object(
                obj_id=content_id,
                obj_type="Content",
                properties=content["properties"],
                lifecycle="Rejected",
                owner=content["owner"]
            )
        return False
