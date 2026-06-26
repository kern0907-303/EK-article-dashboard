# Next Step Recommendations: Brand Intelligence OS

This document details recommended next steps for scaling the Source-Centric CLI MVP into a production-grade operations system.

## 1. Concrete Crawler API Integrations
* **Objective**: Replace mock discovery with live data extraction.
* **Implementation**: Write concrete class endpoints inside discovery/monitor plugins referencing API keys (e.g. Firecrawl API for web-to-markdown extraction, YouTube API to pull stats, Similarweb to pull traffic score, and RSS parser to read feed endpoints).

## 2. Pluggable Scoring Formula Registry
* **Objective**: Enable user-defined scoring formulas.
* **Implementation**: Store scoring formula weight vectors inside database Plugin or Brand Metadata objects, allowing the user to tune weights (e.g., placing higher emphasis on SEO or conversion values) dynamically without modifying code.

## 3. Semantic Vector Graph Queries
* **Objective**: Scale Knowledge Graph semantic retrieval.
* **Implementation**: Integrate a vector database engine (e.g. pgvector or Qdrant) storing embeddings of Pain Points, Desires, and Patterns. This enables semantic search across the Category ➔ Source ➔ Content path.

## 4. Real AI Model routing Integration
* **Objective**: Connect Orchestrator routing to real LLM providers.
* **Implementation**: Populate `.env` credentials and connect Google GenAI SDK (for Gemini), Anthropic API client (for Claude), and OpenAI API client (for ChatGPT) inside the runner.
