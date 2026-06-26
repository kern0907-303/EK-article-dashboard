import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "database", "orchestrator.db")

def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Universal Objects Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS objects (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        properties TEXT NOT NULL, -- JSON string holding object attributes
        lifecycle TEXT NOT NULL,
        owner TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 2. Universal Object Relations Table (Knowledge Graph Edges)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS object_relations (
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        properties TEXT, -- JSON string holding edge attributes
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source_id, target_id, relation_type),
        FOREIGN KEY (source_id) REFERENCES objects(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES objects(id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()

# --- Object CRUD Helpers ---

def save_object(obj_id: str, obj_type: str, properties: dict, lifecycle: str = "Active", owner: str = None) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    properties_json = json.dumps(properties, ensure_ascii=False)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        # Check if exists
        cursor.execute("SELECT 1 FROM objects WHERE id = ?", (obj_id,))
        exists = cursor.fetchone()
        
        if exists:
            cursor.execute("""
            UPDATE objects 
            SET type = ?, properties = ?, lifecycle = ?, owner = ?, updated_at = ?
            WHERE id = ?
            """, (obj_type, properties_json, lifecycle, owner, now, obj_id))
        else:
            cursor.execute("""
            INSERT INTO objects (id, type, properties, lifecycle, owner, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (obj_id, obj_type, properties_json, lifecycle, owner, now, now))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error saving object {obj_id}: {e}")
        return False
    finally:
        conn.close()

def get_object(obj_id: str) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM objects WHERE id = ?", (obj_id,))
        row = cursor.fetchone()
        if row:
            res = dict(row)
            res["properties"] = json.loads(res["properties"])
            return res
        return None
    finally:
        conn.close()

def delete_object(obj_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM objects WHERE id = ?", (obj_id,))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error deleting object {obj_id}: {e}")
        return False
    finally:
        conn.close()

def get_objects_by_type(obj_type: str) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM objects WHERE type = ? ORDER BY created_at DESC", (obj_type,))
        rows = cursor.fetchall()
        result = []
        for row in rows:
            res = dict(row)
            res["properties"] = json.loads(res["properties"])
            result.append(res)
        return result
    finally:
        conn.close()

# --- Relationship CRUD Helpers ---

def add_relation(source_id: str, target_id: str, relation_type: str, properties: dict = None) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    properties_json = json.dumps(properties or {}, ensure_ascii=False)
    try:
        cursor.execute("""
        INSERT OR REPLACE INTO object_relations (source_id, target_id, relation_type, properties)
        VALUES (?, ?, ?, ?)
        """, (source_id, target_id, relation_type, properties_json))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error adding relation {source_id} -> {target_id} ({relation_type}): {e}")
        return False
    finally:
        conn.close()

def get_relations(source_id: str) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM object_relations WHERE source_id = ?", (source_id,))
        rows = cursor.fetchall()
        result = []
        for row in rows:
            res = dict(row)
            res["properties"] = json.loads(res["properties"])
            result.append(res)
        return result
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
    print("Database schema successfully re-initialized with Universal Object Table at", DB_PATH)
