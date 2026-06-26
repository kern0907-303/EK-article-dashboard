import os
import urllib.request
import re
import json
from .utils import get_api_key, read_prompt

def collect_content(input_source: str) -> str:
    """
    Collects content from a URL or raw text.
    In Mock mode, simulates scraping/extraction.
    In Real mode, calls Gemini API to extract clean content.
    """
    api_key = get_api_key("GEMINI_API_KEY")
    prompt = read_prompt("gemini_collect.txt")
    
    # 1. Fetch raw text if input is a URL
    raw_text = input_source
    is_url = input_source.startswith("http://") or input_source.startswith("https://")
    
    if is_url:
        try:
            # Try to fetch actual HTML using urllib (no external deps)
            req = urllib.request.Request(
                input_source, 
                headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode('utf-8', errors='ignore')
                # Strip simple HTML tags to get raw text
                raw_text = re.sub(r'<script.*?</script>', '', html, flags=re.DOTALL)
                raw_text = re.sub(r'<style.*?</style>', '', raw_text, flags=re.DOTALL)
                raw_text = re.sub(r'<[^>]+>', ' ', raw_text)
                raw_text = "\n".join([line.strip() for line in raw_text.splitlines() if line.strip()])
        except Exception as e:
            # Fallback for mock/failed URLs
            raw_text = f"Mock website content for URL: {input_source}\nTitle: High Ticket Funnels and Mindset\nBody: This sales page describes how ABL (State-adjustment) combined with Russell Brunson's Secrets style value ladders can scale your business. Focus on state-shifting, getting into high vibration, and selling high-ticket offers using direct response copy. Crucial keys include Dream 100, Hook-Story-Offer, and ABL routines."

    # 2. Check if we should use Mock or Real
    if not api_key:
        # Mock mode
        # Generate a nice clean mock markdown
        title = "High Ticket Scaling via Mindset & Value Ladders"
        if is_url:
            # Try to extract something from URL
            match = re.search(r'https?://(?:www\.)?([^/]+)', input_source)
            if match:
                title = f"Content from {match.group(1)}"
        
        mock_markdown = f"""# {title}

## Introduction
Scaling a business requires a combination of strategic marketing frameworks and personal state-adjustment. Without the right mindset, even the best funnel will fail.

## Core Pillars
1. **Value Ladder**: Map out a path where customers can climb from free/low-cost front-end offers to high-ticket back-end offers.
2. **State Adjustment (ABL)**: Align your energy and focus daily. State adjustment is the foundation of peak performance.
3. **Dream 100**: Find where your dream clients congregate and build relationships with those channel owners.

## Conclusion
Implement this routine to shift your business state and double your conversions.
"""
        return mock_markdown
    
    # Real mode: Call Gemini API using urllib
    # Model: gemini-1.5-flash
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    data = {
        "contents": [{
            "parts": [
                {"text": f"{prompt}\n\nInput Source:\n{raw_text}"}
            ]
        }]
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
            extracted_text = result['candidates'][0]['content']['parts'][0]['text']
            return extracted_text.strip()
    except Exception as e:
        # Fallback if API call fails
        print(f"Gemini API call failed ({e}). Falling back to Mock.")
        return f"# Gemini Fallback: Content\n\nFailed to call Gemini API: {str(e)}\n\nRaw source text preview:\n{raw_text[:200]}"
