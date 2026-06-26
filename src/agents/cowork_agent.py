import os
from datetime import datetime

KB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "storage",
    "knowledge_base.md"
)

def update_knowledge_base(brand_id: str, intelligence_card: dict) -> str:
    """
    Appends new intelligence card details and insights to the knowledge base (markdown file).
    """
    os.makedirs(os.path.dirname(KB_PATH), exist_ok=True)
    
    # 1. Initialize file if it doesn't exist
    if not os.path.exists(KB_PATH):
        with open(KB_PATH, "w", encoding="utf-8") as f:
            f.write("# AI Content Factory - Shared Knowledge Base\n\nThis knowledge base stores cleaned intelligence insights generated across all pipeline runs.\n\n")

    title = intelligence_card.get("title", "Untitled Content")
    summary = intelligence_card.get("summary", "No summary provided.")
    themes = ", ".join(intelligence_card.get("key_themes", []))
    audience = intelligence_card.get("target_audience", {}).get("profile", "General Audience")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # 2. Format the new insight entry
    entry = f"""
## [{timestamp}] {title} (Brand: {brand_id})
- **Summary**: {summary}
- **Key Themes**: {themes}
- **Target Audience Profile**: {audience}
- **Extracted Claims**:
"""
    for claim in intelligence_card.get("key_claims", []):
        entry += f"  - {claim}\n"
    
    entry += "\n---\n"
    
    # 3. Append to markdown file
    with open(KB_PATH, "a", encoding="utf-8") as f:
        f.write(entry)
        
    return KB_PATH
