Mac mini 生圖小程式 安裝說明（一頁版）

它做什麼
  儀表板按「本機 ComfyUI 底圖（免費）」→ 這支小程式自動收到 → 叫你 Mac mini 上的 ComfyUI 生圖 →
  圖上傳到你的 Supabase 儲存桶 → 儀表板自動拿來做圖卡或配圖。
  不用定時、不用 n8n、不需要把 Mac mini 對外開放（是它主動連出去）。

事前要有
  1. ComfyUI 已經裝好、且至少有一個模型（checkpoints 資料夾裡有 .safetensors 或 .ckpt）。
  2. ComfyUI 保持開著（預設網址 http://127.0.0.1:8188）。
  3. Node.js 20.6 以上（沒有的話到 nodejs.org 裝 LTS）。
  4. Supabase 已執行過 docs/sql/2026-10-11_image_jobs.sql（只要做一次）。

安裝（只做一次）
  1. 把整個 mac-worker 資料夾放到 Mac mini 任何位置，例如「文件」。
  2. 開「終端機」，輸入 cd 空格，把 mac-worker 資料夾拖進終端機視窗，按 Enter。
  3. 輸入 bash install.sh，按 Enter。第一次會建立 .env 並停下來。
  4. 用文字編輯器打開 mac-worker/.env，填入：
       SUPABASE_URL（Supabase 專案網址）
       SUPABASE_SERVICE_ROLE_KEY（和 Render 上同一把）
     存檔。
  5. 再輸入一次 bash install.sh。看到「完成」就好了。之後開機自動執行。

怎麼知道有沒有在線
  儀表板按本機底圖時，會顯示「等 Mac mini 領單」；若 Mac mini 沒開機或程式沒開，會寫明
  「Mac mini 目前沒有回應」。單會留著，開機後自動補做；你也可以取消，改用品牌色底。

模型選擇
  預設自動挑：先找名稱含 xl 的，否則用清單第一個。想指定，改 config.json 的 preferredCheckpoint
  （填模型檔名，或名稱的一部分）。你不用匯出任何 ComfyUI 流程檔。

常見問題
  - 運作紀錄：mac-worker/worker.log
  - 單一直是「失敗」：看儀表板顯示的原因；多半是 ComfyUI 沒開或沒有模型。
  - 底圖很怪（重複、變形）：模型是舊的 SD1.5 卻被當成大圖模型。把 config.json 的 modelFamily 改成 "sd15"。
  - 加速版模型（名稱含 turbo、lightning）會自動用較少步數。

安全提醒
  .env 裡的 SUPABASE_SERVICE_ROLE_KEY 權限很大（等同資料庫管理員）。只放在這台 Mac mini，
  不要上傳 GitHub、不要貼給任何人。若懷疑外流，到 Supabase 的 API 設定更換這把金鑰，
  並同步更新 Render 與這個 .env。

安全網（選用）
  Realtime 連線理論上會自動重連，重連時會補掃漏掉的單。若你想多一層保險，可把 config.json 的
  safetyScanMinutes 設成 5（每 5 分鐘額外檢查一次等待中的單）。預設 0 = 不輪詢。
