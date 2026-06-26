import os
import json
import urllib.request
from .utils import get_api_key, read_prompt

def clean_content(raw_markdown: str) -> dict:
    """
    Cleans raw markdown and extracts a Content Intelligence Card.
    In Mock mode, generates a structured JSON card dynamically.
    In Real mode, calls Claude API.
    """
    api_key = get_api_key("ANTHROPIC_API_KEY")
    prompt = read_prompt("claude_clean.txt")
    
    # 2. Check if Mock or Real
    if not api_key:
        # Mock mode
        # Extract title from raw markdown if possible
        title = "High Ticket Scaling via Mindset & Value Ladders"
        for line in raw_markdown.splitlines():
            if line.startswith("# "):
                title = line.replace("# ", "").strip()
                break
        
        mock_card = {
            "title": title,
            "summary": "This content explains how to scale a business to high-ticket offers using a combination of marketing value ladders, direct response principles, and personal energy/state alignment (ABL).",
            "key_themes": ["Mindset Shift", "High-Ticket Funnels", "Dream 100", "State Adjustment"],
            "target_audience": {
                "profile": "Entrepreneurs, service providers, and knowledge creators who feel stuck at low price points and low energy levels.",
                "pain_points": [
                    "Exhaustion from selling cheap courses or products",
                    "Lack of clear path to sell high-ticket offers",
                    "Low daily energy/state and lack of focus"
                ]
            },
            "emotional_triggers": ["Frustration with low margins", "Desire for business freedom", "Aspiration for high energy performance"],
            "key_claims": [
                "Selling high-ticket offers is easier than selling low-ticket if the value is clear.",
                "State-adjustment (ABL) is the prerequisite for marketing conversions.",
                "Dream 100 allows you to tap into existing streams of traffic instead of buying ads."
            ],
            "hooks": [
                "Why your low-ticket courses are keeping you broke, and the single mindset shift to change it.",
                "How to double your conversions before writing a single word of copy (the ABL method)."
            ]
        }
        return mock_card
        
    # Real mode: Call Anthropic Claude API using urllib
    url = "https://api.anthropic.com/v1/messages"
    data = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 2040,
        "messages": [
            {
                "role": "user",
                "content": f"{prompt}\n\nRaw Markdown:\n{raw_markdown}"
            }
        ]
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
            response_text = result['content'][0]['text'].strip()
            # Clean possible markdown wrapping if Claude adds it despite instruction
            if response_text.startswith("```json"):
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif response_text.startswith("```"):
                response_text = response_text.split("```")[1].split("```")[0].strip()
            return json.loads(response_text)
    except Exception as e:
        print(f"Claude API call failed ({e}). Falling back to Mock.")
        # Fallback card
        return {
            "title": f"Fallback Card: {title[:30]}...",
            "summary": f"Fallback card generated due to API error: {str(e)}",
            "key_themes": ["Fallback"],
            "target_audience": {"profile": "System Admins", "pain_points": ["API failure"]},
            "emotional_triggers": ["Anxiety"],
            "key_claims": ["API needs keys"],
            "hooks": ["How to fix your API keys"]
        }
