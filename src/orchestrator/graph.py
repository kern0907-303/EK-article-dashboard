import json
from ..database import save_object, get_object, add_relation, get_relations, get_db_connection

class KnowledgeGraph:
    @staticmethod
    def create_node(node_id: str, node_type: str, properties: dict, lifecycle: str = "Active", owner: str = "system") -> bool:
        """Create a generic Object (node) in the database."""
        return save_object(
            obj_id=node_id,
            obj_type=node_type,
            properties=properties,
            lifecycle=lifecycle,
            owner=owner
        )

    @staticmethod
    def create_edge(source_id: str, target_id: str, relation_type: str, properties: dict = None) -> bool:
        """Create a relation link (edge) between two objects."""
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
    def get_all_nodes(node_type: str = None) -> list:
        """Retrieves all objects, optionally filtered by type."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            if node_type:
                cursor.execute("SELECT * FROM objects WHERE type = ?", (node_type,))
            else:
                cursor.execute("SELECT * FROM objects")
                
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
    def trace_source_centric_path(category_id: str) -> list:
        """
        Traces paths from Category -> Source -> Content -> Pattern -> Decision.
        Returns a list of matching path dictionaries representing Scenario 6.
        """
        paths = []
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
            SELECT 
                cat.id as cat_id, cat.properties as cat_props,
                src.id as src_id, src.properties as src_props,
                cnt.id as cnt_id, cnt.properties as cnt_props,
                pat.id as pat_id, pat.properties as pat_props,
                dec.id as dec_id, dec.properties as dec_props
            FROM objects cat
            JOIN object_relations r1 ON cat.id = r1.source_id AND r1.relation_type = 'contains_source'
            JOIN objects src ON r1.target_id = src.id
            JOIN object_relations r2 ON src.id = r2.source_id AND r2.relation_type = 'produces_content'
            JOIN objects cnt ON r2.target_id = cnt.id
            JOIN object_relations r3 ON cnt.id = r3.source_id AND r3.relation_type = 'links_to_pattern'
            JOIN objects pat ON r3.target_id = pat.id
            JOIN object_relations r4 ON pat.id = r4.source_id AND r4.relation_type = 'leads_to_decision'
            JOIN objects dec ON r4.target_id = dec.id
            WHERE cat.id = ?
            """, (category_id,))
            
            rows = cursor.fetchall()
            for row in rows:
                paths.append({
                    "category": {"id": row["cat_id"], "properties": json.loads(row["cat_props"])},
                    "source": {"id": row["src_id"], "properties": json.loads(row["src_props"])},
                    "content": {"id": row["cnt_id"], "properties": json.loads(row["cnt_props"])},
                    "pattern": {"id": row["pat_id"], "properties": json.loads(row["pat_props"])},
                    "decision": {"id": row["dec_id"], "properties": json.loads(row["dec_props"])}
                })
        except Exception as e:
            print(f"Error tracing source centric path: {e}")
        finally:
            conn.close()
            
        return paths
