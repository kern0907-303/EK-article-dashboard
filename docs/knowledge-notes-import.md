# 知識筆記匯入

先在 Supabase SQL Editor 執行 `docs/sql/2026-10-07_knowledge_notes.sql`，再於有伺服器端環境變數的本機執行：

```sh
node --env-file=.env.local scripts/import-knowledge-notes.mjs /path/to/knowledge_notes.jsonl
```

腳本以 `source_file` 為唯一鍵，內容 MD5 相同時略過，內容變更時更新；輸出新增、更新、略過數與各 domain 筆數。只使用 `NEXT_PUBLIC_SUPABASE_URL` 作為伺服器端資料庫網址及 `SUPABASE_SERVICE_ROLE_KEY` 驗證，絕不可將 service role key 放入瀏覽器程式或 `NEXT_PUBLIC_` 變數。
