# Incident Response Playbook

This playbook defines the quick-action protocols for addressing outages, service timeouts, and database lockouts in the Brand Intelligence OS.

---

## Incident Workflows & Resolutions

### Incident 1: Gemini API Unavailable
* **Symptom**: Google API returns HTTP 400/403/500, or network connection fails. Gemini agent logs API errors.
* **Immediate System Action**: Automatically switches to local mock markdown extraction to prevent workflow crash.
* **Response Protocol**:
  1. Verify the `GEMINI_API_KEY` in `.env`.
  2. Check Google Developer API Dashboard for outage status.
  3. Validate API connection via curl:
     ```bash
     curl -H "Content-Type: application/json" -d '{"contents":[{"parts":[{"text":"test"}]}]}' "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GEMINI_API_KEY"
     ```

### Incident 2: OpenAI API Unavailable
* **Symptom**: Chat completions fail, billing limit hit, or service down.
* **Immediate System Action**: ChatGPT agent falls back to generating mock marketing copy drafts.
* **Response Protocol**:
  1. Check OpenAI Status Page (`status.openai.com`).
  2. Check OpenAI account usage limits.
  3. Test connection:
     ```bash
     curl https://api.openai.com/v1/chat/completions -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"test"}]}'
     ```

### Incident 3: Firecrawl Timeout
* **Symptom**: Firecrawl API request exceeds the 20-second timeout limit.
* **Immediate System Action**: Firecrawl scraper plugin catches timeout exception and scrapes webpage HTML raw text directly.
* **Response Protocol**:
  1. Check target page size (large pages may cause timeouts).
  2. Verify Firecrawl status.

### Incident 4: RSS Invalid/Malformed Feed
* **Symptom**: XML structure parsing fails due to invalid tags or malformed XML.
* **Immediate System Action**: Plugin catches parsing exceptions, prints an error log, and returns simulated competitor feed details.
* **Response Protocol**:
  1. Inspect the feed URL layout.
  2. If feed is Atom format, verify XML namespaces in the tags.

### Incident 5: Knowledge Graph Corruption
* **Symptom**: SQLite query returns `database disk image is malformed` or integrity errors.
* **Immediate System Action**: Halts execution to avoid further data loss.
* **Response Protocol**:
  1. Inspect corruption:
     ```bash
     sqlite3 database/orchestrator.db "PRAGMA integrity_check;"
     ```
  2. If malformed, restore database from the last nightly backup:
     ```bash
     cp database/orchestrator_backup.db database/orchestrator.db
     ```

### Incident 6: SQLite Database Lock
* **Symptom**: Query throws `database is locked` error due to multiple concurrent database writes.
* **Immediate System Action**: Query retries fail, blocking the workflow execution.
* **Response Protocol**:
  1. Check for running orphan processes holding locks:
     ```bash
     lsof database/orchestrator.db
     ```
  2. Terminate orphan locking processes:
     ```bash
     kill -9 <PID>
     ```
  3. Verify that the SQLite connection configuration has `PRAGMA busy_timeout = 30000` set to prevent immediate locking under normal parallel runs.
