# Backup and Recovery Procedures

This guide provides simple backup routines and restoration commands for the database and reports in the Brand Intelligence OS.

---

## 1. Database Backup (SQLite)

The core database file is located at `database/orchestrator.db`.

### Hot Backup Command (Safe to run during execution)
```bash
sqlite3 database/orchestrator.db ".backup database/orchestrator_backup.db"
```

### Restore Database from Backup
```bash
cp database/orchestrator_backup.db database/orchestrator.db
```

---

## 2. Registry & Content Exports

### Backup Source Registry to JSON
Run this SQL command to dump active source configurations to a JSON file:
```bash
sqlite3 database/orchestrator.db "SELECT json_group_array(json_object('id', id, 'type', type, 'properties', json(properties))) FROM objects WHERE type = 'Source';" > backup/source_registry_backup.json
```

### Backup Asset Drafts
Dump draft content assets (Facebook posts, Reels video scripts) to a JSON file:
```bash
sqlite3 database/orchestrator.db "SELECT json_group_array(json_object('id', id, 'properties', json(properties))) FROM objects WHERE type = 'Asset';" > backup/asset_registry_backup.json
```

---

## 3. Daily Intelligence Reports Backup

Copy daily reports to the long-term archiving folder:
```bash
mkdir -p backup/daily_reports/
cp *_report.md backup/daily_reports/
```

---

## 4. Disaster Recovery Validation Checks

In the event of database corruption or file lockups, verify database structure and repair using:
```bash
# Verify Integrity
sqlite3 database/orchestrator.db "PRAGMA integrity_check;"

# Repair malformed database
sqlite3 database/orchestrator.db .dump > dump.sql
rm database/orchestrator.db
sqlite3 database/orchestrator.db < dump.sql
```
