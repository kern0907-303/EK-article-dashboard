# API Configuration

The Brand Intelligence OS uses direct REST calls to external LLM providers and scraper gateways. This document lists the environment variables and configurations required.

---

## 1. Environment Variables

Define the following keys in your system environment or in a `.env` file at the project root:

```ini
# OpenAI Chat Completions API
OPENAI_API_KEY=your_openai_api_key_here

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Firecrawl Web Scraper API
FIRECRAWL_API_KEY=your_firecrawl_api_key_here

# (Optional) Anthropic Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

---

## 2. API Endpoints & Models

The following endpoints are called directly using standard HTTP request libraries:

### 1. Google Gemini API
* **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}`
* **Model**: `gemini-1.5-flash`
* **Purpose**: Collect raw scraped webpage/feed content and extract clean markdown.

### 2. OpenAI API
* **Endpoint**: `https://api.openai.com/v1/chat/completions`
* **Model**: `gpt-4o-mini`
* **Response Format**: `{"type": "json_object"}`
* **Purpose**: Copywrite and translate analyzed competitor insights into brand-specific daily drafts.

### 3. Anthropic Claude API (Optional)
* **Endpoint**: `https://api.anthropic.com/v1/messages`
* **Model**: `claude-3-5-sonnet-20241022`
* **Headers**: `x-api-key`, `anthropic-version: 2023-06-01`
* **Purpose**: Perform high-precision pain-point extraction and structure analysis cards.
