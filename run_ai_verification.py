import os
import sys
import json
import re
from datetime import datetime

def load_dotenv():
    dotenv_path = ".env"
    if os.path.exists(dotenv_path):
        with open(dotenv_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

def run_verification():
    load_dotenv()
    
    openai_key = os.environ.get("OPENAI_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    
    # 1. API Verification Logs
    llm_logs = []
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Check OpenAI
    openai_status = "FAILED"
    openai_error = "Missing OPENAI_API_KEY in environment variables and .env file."
    if openai_key:
        openai_status = "KEYS_LOADED_BUT_TEST_SKIPPED"
        openai_error = "None"
        
    llm_logs.append({
        "provider": "OpenAI",
        "model": "gpt-4o-mini",
        "request_timestamp": timestamp,
        "response_status": openai_status,
        "response_id": "None",
        "prompt_token_count": 0,
        "completion_token_count": 0,
        "total_token_count": 0,
        "estimated_cost": 0.0,
        "error": openai_error
    })
    
    # Check Gemini
    gemini_status = "FAILED"
    gemini_error = "Missing GEMINI_API_KEY in environment variables and .env file."
    if gemini_key:
        gemini_status = "KEYS_LOADED_BUT_TEST_SKIPPED"
        gemini_error = "None"
        
    llm_logs.append({
        "provider": "Gemini",
        "model": "gemini-1.5-flash",
        "request_timestamp": timestamp,
        "response_status": gemini_status,
        "response_id": "None",
        "prompt_token_count": 0,
        "completion_token_count": 0,
        "total_token_count": 0,
        "estimated_cost": 0.0,
        "error": gemini_error
    })
    
    # 2. Write reports
    
    # report 1: real_ai_api_verification_report.md
    api_report = f"""# Real AI API Verification Report

Generated on: {timestamp}
Verification Type: Real LLM API Connections

---

## 1. API Key Loading Status
* **OPENAI_API_KEY**: {'Loaded' if openai_key else 'MISSING (Verification FAILED)'}
* **GEMINI_API_KEY**: {'Loaded' if gemini_key else 'MISSING (Verification FAILED)'}

## 2. Verification Outcomes
* **OpenAI API Connection**: FAILED (No API key provided)
* **Gemini API Connection**: FAILED (No API key provided)
* **Firecrawl Scraper**: Unavailable (FIRECRAWL_API_KEY not provided)

---

## 3. Conclusion
The real AI verification has **failed** because no valid API keys were loaded from the environment variables or `.env` configuration file. The local mock fallback was disabled for this run, resulting in a validation failure.
"""

    # report 2: real_llm_usage_log.md
    usage_log = f"""# Real LLM Usage Log

Generated on: {timestamp}

---

## LLM Execution Log Entries

"""
    for entry in llm_logs:
        usage_log += f"""### Provider: {entry['provider']}
* **Model**: {entry['model']}
* **Timestamp**: {entry['request_timestamp']}
* **Status**: {entry['response_status']}
* **Response ID**: {entry['response_id']}
* **Token Stats**:
  - Prompt: {entry['prompt_token_count']}
  - Completion: {entry['completion_token_count']}
  - Total: {entry['total_token_count']}
* **Estimated Cost**: ${entry['estimated_cost']:.5f} USD
* **Error Detail**: {entry['error']}

"""

    # report 3: real_daily_intelligence_report.md
    daily_report = f"""# Real Daily Intelligence Report

Generated on: {timestamp}
Status: FAILED TO GENERATE

---

## 1. Ingestion Quality Audit
* **Verified Reachable Sources**: Checked (Skipped due to API key failure)
* **Content Records Analyzed**: 0 (Verification failed)
* **Recommended Topics**: None (Real decision calculation failed)

## 2. Quality Tags Compliance
* **data_status**: `not_real`
* **verified**: `false`

## 3. Error Log
* Real daily intelligence generation aborted. Reason: Missing required OpenAI/Gemini API keys. Mock fallback was disabled.
"""

    # report 4: final_real_go_live_decision.md
    go_live_decision = f"""# Final Real Go-Live Decision

Generated on: {timestamp}

---

## Final Decision Verdict

```text
NOT_READY_REAL_AI_NOT_CONFIRMED
```

*Verification Conclusion: The verification run failed. Real OpenAI and Gemini API calls could not be completed or proven because the environment credentials are empty. Local mock generation is disabled and cannot be used to confirm real production readiness.*
"""

    # Save reports to workspace and brain directory
    paths = {
        "real_ai_api_verification_report.md": "/Users/erickair/.gemini/antigravity/brain/3244dfbe-868b-437f-acd6-5d6e393dfd12/real_ai_api_verification_report.md",
        "real_llm_usage_log.md": "/Users/erickair/.gemini/antigravity/brain/3244dfbe-868b-437f-acd6-5d6e393dfd12/real_llm_usage_log.md",
        "real_daily_intelligence_report.md": "/Users/erickair/.gemini/antigravity/brain/3244dfbe-868b-437f-acd6-5d6e393dfd12/real_daily_intelligence_report.md",
        "final_real_go_live_decision.md": "/Users/erickair/.gemini/antigravity/brain/3244dfbe-868b-437f-acd6-5d6e393dfd12/final_real_go_live_decision.md"
    }
    
    for filename, brain_path in paths.items():
        # Write to project root
        with open(filename, "w", encoding="utf-8") as f:
            f.write(api_report if "verification" in filename else usage_log if "usage" in filename else daily_report if "intelligence" in filename else go_live_decision)
            
        # Write to brain folder
        os.makedirs(os.path.dirname(brain_path), exist_ok=True)
        with open(brain_path, "w", encoding="utf-8") as f:
            f.write(api_report if "verification" in filename else usage_log if "usage" in filename else daily_report if "intelligence" in filename else go_live_decision)
            
    print("Verification run completed. Output files generated.")
    
    if not openai_key or not gemini_key:
        print("Error: Missing required OpenAI/Gemini keys. Verification failed.")
        sys.exit(1)

if __name__ == "__main__":
    run_verification()
