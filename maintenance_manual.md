# Maintenance Manual

This manual documents troubleshooting procedures, fallback behaviors, and database recovery actions for the Brand Intelligence OS.

---

## 1. Troubleshooting & Fallback Systems

### RSS Failure
* **Failure Modes**: Network timeout, XML parsing exception, feed offline.
* **System Action**: Logs an error. Automatically redirects feed processing to return mock competitor summaries.
* **Resolution**: Verify URL feed validity. Add browser header overrides if target servers block requests.

### Firecrawl Failure
* **Failure Modes**: Firecrawl API down, invalid markdown format.
* **System Action**: Falls back to direct HTTP request scraping, stripping script and HTML tags to generate a raw text fallback summary.
* **Resolution**: Check Mendable Firecrawl API key credit status.

### API Failure
* **Failure Modes**: Network connection reset, model service outage (Gemini/OpenAI).
* **System Action**: Urllib request exception caught in `src/agents/`. Agent falls back to mock template content, ensuring pipeline continuity.
* **Resolution**: Check network connectivity and API keys.

### Rate Limits (HTTP 429)
* **Failure Modes**: Concurrent task congestion, exceeding TPM/RPM.
* **System Action**: urllib throws error, triggering mock fallback mode.
* **Resolution**: Implement retry-after headers or add request pacing (sleep delays) between model dispatches.

### Router Fallback
* **Failure Modes**: Unrecognized or custom capability requested.
* **System Action**: The capability router falls back to default routing sequence: `["deep_analysis", "copywriting"]` mapped to `claude` and `chatgpt` models.

---

## 2. Database Recovery (SQLite)

The system database is stored at `database/orchestrator.db`.

### Backing Up the Database
Run the SQLite backup command to create a snapshot:
```bash
sqlite3 database/orchestrator.db ".backup database/orchestrator_backup.db"
```

### Restoring the Database
To restore from a backup file:
```bash
cp database/orchestrator_backup.db database/orchestrator.db
```

### Repairing Corruption
If database corruption occurs, dump and re-build:
```bash
sqlite3 database/orchestrator.db .dump > dump.sql
rm database/orchestrator.db
sqlite3 database/orchestrator.db < dump.sql
```
