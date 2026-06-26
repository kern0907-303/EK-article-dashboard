import json
from ..database import save_object, get_object, add_relation, get_relations, get_db_connection

class KnowledgeGraph:
    @staticmethod
    def create_node(node_id: str, node_type: str, properties: dict) -> bool:
        """Create a Knowledge Node object in the database."""
        return save_object(
            obj_id=node_id,
            obj_type="Knowledge Node",
            properties={"semantic_type": node_type, **properties},
            lifecycle="Knowledge",
            owner="system"
        )

    @staticmethod
    def create_edge(source_id: str, target_id: str, relation_type: str, properties: dict = None) -> bool:
        """Create a Knowledge Edge relation link in the database."""
        return add_relation(
            source_id=source_id,
            target_id=target_id,
            relation_type=relation_type,
            properties=properties or {}
        )

    @staticmethod
    def query_connected_nodes(node_id: str, relation_type: str = None) -> list:
        """Traverses edges to find all target nodes connected to the source node."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            if relation_type:
                cursor.execute("""
                SELECT o.* FROM objects o
                JOIN object_relations r ON o.id = r.target_id
                WHERE r.source_id = ? AND r.relation_type = ?
                """, (node_id, relation_type))
            else:
                cursor.execute("""
                SELECT o.* FROM objects o
                JOIN object_relations r ON o.id = r.target_id
                WHERE r.source_id = ?
                """, (node_id,))
                
            rows = cursor.fetchall()
            nodes = []
            for row in rows:
                n = dict(row)
                n["properties"] = json.loads(n["properties"])
                nodes.append(n)
            return nodes
        finally:
            conn.close()

    @staticmethod
    def get_all_nodes(semantic_type: str = None) -> list:
        """Retrieves all Knowledge Nodes, optionally filtered by semantic category."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            if semantic_type:
                cursor.execute("""
                SELECT * FROM objects 
                WHERE type = 'Knowledge Node' AND json_extract(properties, '$.semantic_type') = ?
                """, (semantic_type,))
            else:
                cursor.execute("SELECT * FROM objects WHERE type = 'Knowledge Node'")
                
            rows = cursor.fetchall()
            nodes = []
            for row in rows:
                n = dict(row)
                n["properties"] = json.loads(n["properties"])
                nodes.append(n)
            return nodes
        finally:
            conn.close()
