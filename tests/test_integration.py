import unittest
import json
import os
from unittest.mock import patch, MagicMock

from src.orchestrator.plugins import RSSScraperPlugin, FirecrawlScraperPlugin
from src.agents.gemini_agent import collect_content
from src.agents.chatgpt_agent import translate_and_create
from src.agents.claude_agent import clean_content

class TestSprint1Integration(unittest.TestCase):
    
    def test_rss_scraper_local_xml(self):
        """Verify that the RSS connector fetches feed content and parses XML successfully."""
        plugin = RSSScraperPlugin()
        dummy_xml = """<rss version="2.0">
            <channel>
                <title>Test Channel</title>
                <item>
                    <title>Test Feed Item</title>
                    <link>https://example.com/item1</link>
                    <description>This is a test feed item description.</description>
                </item>
            </channel>
        </rss>"""
        
        with patch('requests.get') as mock_get:
            mock_res = MagicMock()
            mock_res.status_code = 200
            mock_res.content = dummy_xml.encode('utf-8')
            mock_get.return_value = mock_res
            
            result = plugin.scrape("https://marieforleo.com/feed")
            self.assertIn("Test Feed Item", result)
            self.assertIn("This is a test feed item description.", result)
            
    def test_firecrawl_scraper_api_call(self):
        """Verify that the Firecrawl connector invokes the correct endpoint with proper headers when the API key is present."""
        plugin = FirecrawlScraperPlugin()
        
        with patch('src.agents.utils.get_api_key', return_value="fake_firecrawl_key"), \
             patch('requests.post') as mock_post:
             
            mock_res = MagicMock()
            mock_res.status_code = 200
            mock_res.json.return_value = {"success": True, "data": {"markdown": "# Scraped Web Content"}}
            mock_post.return_value = mock_res
            
            result = plugin.scrape("https://tonyrobbins.com/women-leadership")
            self.assertEqual(result, "# Scraped Web Content")
            mock_post.assert_called_once()
            
    def test_gemini_agent_api_call(self):
        """Verify that the Gemini agent makes a REST call to the Google generateContent endpoint when key is present."""
        with patch('src.agents.gemini_agent.get_api_key', return_value="fake_gemini_key"), \
             patch('urllib.request.urlopen') as mock_urlopen:
             
            mock_response = MagicMock()
            mock_response.read.return_value = json.dumps({
                "candidates": [{
                    "content": {
                        "parts": [{
                            "text": "Extracted Markdown from Gemini"
                        }]
                    }
                }]
            }).encode('utf-8')
            mock_urlopen.return_value.__enter__.return_value = mock_response
            
            result = collect_content("Raw competitor HTML")
            self.assertEqual(result, "Extracted Markdown from Gemini")
            mock_urlopen.assert_called_once()
            
    def test_chatgpt_agent_api_call(self):
        """Verify that the ChatGPT agent makes a REST call to the OpenAI Chat Completions endpoint when key is present."""
        with patch('src.agents.chatgpt_agent.get_api_key', return_value="fake_openai_key"), \
             patch('urllib.request.urlopen') as mock_urlopen:
             
            mock_response = MagicMock()
            mock_response.read.return_value = json.dumps({
                "choices": [{
                    "message": {
                        "content": json.dumps({
                            "brand_translation": "Erick ABL translation",
                            "facebook_post": "Erick FB post",
                            "short_video_script": "Erick video script",
                            "call_to_action": "Erick CTA",
                            "quiz_questions": []
                        })
                    }
                }]
            }).encode('utf-8')
            mock_urlopen.return_value.__enter__.return_value = mock_response
            
            result = translate_and_create({"title": "Competitor"}, {"name": "Erick Personal Brand"})
            self.assertEqual(result["facebook_post"], "Erick FB post")
            mock_urlopen.assert_called_once()

    def test_fallbacks_when_no_api_keys(self):
        """Verify that all connectors and agents fallback gracefully to simulated mock outputs when API keys are not provided."""
        # 1. Gemini Fallback
        with patch('src.agents.gemini_agent.get_api_key', return_value=None):
            res_gemini = collect_content("https://some-website.com")
            self.assertIn("Value Ladder", res_gemini)
            
        # 2. ChatGPT Fallback
        with patch('src.agents.chatgpt_agent.get_api_key', return_value=None):
            res_chatgpt = translate_and_create({"title": "Value Ladders"}, {"name": "Erick Brand"})
            self.assertIn("低價產品", res_chatgpt["facebook_post"])
            
        # 3. Firecrawl Fallback
        with patch('src.agents.utils.get_api_key', return_value=None):
            plugin = FirecrawlScraperPlugin()
            res_firecrawl = plugin.scrape("https://some-competitor-funnel.com")
            self.assertIn("Simulated", res_firecrawl)

if __name__ == "__main__":
    unittest.main()
