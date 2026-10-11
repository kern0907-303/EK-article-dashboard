-- Threads / Instagram 輪播排程：在 social_publish_queue 新增「多張圖片網址」欄位。
-- 在 Supabase SQL Editor 執行一次即可（可重複執行）。沒有執行時：單張圖與純文字排程照常，
-- 只有「排程輪播」會在儀表板顯示寫入失敗，立即發布輪播不受影響。
--
-- 輪播排程存法：image_url 存第一張（相容舊欄位與 Instagram 必填檢查），image_urls 存整組（2 張以上）。
-- n8n 的 Social Queue Runner 會在 image_urls 有 2 張以上時改走輪播發佈。

alter table public.social_publish_queue
  add column if not exists image_urls jsonb;

-- 還原用（不需要時不要執行）：
-- alter table public.social_publish_queue drop column if exists image_urls;
