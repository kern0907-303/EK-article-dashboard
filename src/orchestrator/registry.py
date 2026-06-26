import os
import json
from ..database import save_object, get_object, get_objects_by_type

class AgentRegistry:
    def __init__(self):
        self.config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "config",
            "capabilities.json"
        )
        # Sync JSON configs with SQL Objects database upon init
        self.sync_registry_to_db()

    def sync_registry_to_db(self):
        """Loads capabilities JSON and registers each model as an Agent object in SQLite."""
        if os.path.exists(self.config_path):
            with open(self.config_path, "r", encoding="utf-8") as f:
                agents_data = json.load(f)
                for agent_id, data in agents_data.items():
                    # Format as standardized Object
                    properties = {
                        "model_name": data.get("model_name"),
                        "capabilities": data.get("capabilities", []),
                        "strengths": data.get("strengths"),
                        "limitations": data.get("limitations"),
                        "token_cost": data.get("token_cost", {}),
                        "speed": data.get("speed"),
                        "input_format": data.get("input_format", []),
                        "output_format": data.get("output_format", []),
                        "best_tasks": data.get("best_tasks")
                    }
                    save_object(
                        obj_id=agent_id,
                        obj_type="Agent",
                        properties=properties,
                        lifecycle="Active",
                        owner="system"
                    )

    def get_agent(self, agent_id: str) -> dict:
        """Retrieves an agent object by ID."""
        return get_object(agent_id)

    def get_all_agents(self) -> list:
        """Retrieves all registered Agent objects."""
        return get_objects_by_type("Agent")

    def find_agents_for_capability(self, capability: str) -> list:
        """Finds all agents that possess the specified capability."""
        all_agents = self.get_all_agents()
        matching = []
        for agent in all_agents:
            caps = agent["properties"].get("capabilities", [])
            if capability in caps:
                matching.append(agent)
        return matching
