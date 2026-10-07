-- 多平台衍生：僅新增規格、內容規則與草稿表，不修改既有文章／排程／發佈資料。
-- 可重複執行。source_urls 與 status 對應每筆資料；未有官方來源支持的欄位維持 NULL。

create table if not exists public.platform_specs (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  format text not null,
  max_text_length integer,
  title_max_length integer,
  image_aspect_ratios text[] not null default '{}',
  image_dimensions text,
  carousel_max integer,
  hashtag_max integer,
  hashtag_guidance text,
  video_duration text,
  video_aspect_ratios text[] not null default '{}',
  max_file_size text,
  ai_label_requirement text,
  source_urls text[] not null default '{}',
  checked_at date not null default date '2026-10-07',
  status text not null default 'pending_manual_review' check (status in ('verified', 'pending_manual_review')),
  field_status jsonb not null default '{}'::jsonb,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (platform, format)
);

create table if not exists public.platform_content_rules (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  category text not null,
  language_version text not null check (language_version in ('zh-TW', 'zh-CN')),
  description text not null default '',
  blocked_terms text[] not null default '{}',
  source_urls text[] not null default '{}',
  enabled boolean not null default true,
  block_available boolean not null default true,
  status text not null default 'pending_manual_review' check (status = 'pending_manual_review'),
  notes text not null default '使用者設定的保守攔截詞，不代表平台政策或法律結論；需人工確認。',
  updated_at timestamptz not null default now(),
  unique (platform, category, language_version)
);

create table if not exists public.derivative_posts (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null default gen_random_uuid(),
  parent_article_id text not null,
  parent_brand_id text not null,
  platform text not null,
  format text not null,
  language_version text not null check (language_version in ('zh-TW', 'zh-CN')),
  content text not null,
  check_results jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'available')),
  model_version text not null default '',
  prompt_version text not null,
  source_note_id text,
  source_content_md5 text,
  human_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 允許重複執行及從初版草稿表升級。
alter table public.platform_specs add column if not exists hashtag_max integer;
alter table public.derivative_posts add column if not exists generation_id uuid not null default gen_random_uuid();
alter table public.derivative_posts add column if not exists source_note_id text;
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.derivative_posts'::regclass
      and conname = 'derivative_posts_source_note_id_fkey'
  ) then
    alter table public.derivative_posts drop constraint derivative_posts_source_note_id_fkey;
  end if;
  alter table public.derivative_posts alter column source_note_id type text using source_note_id::text;
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.derivative_posts'::regclass
      and conname = 'derivative_posts_parent_article_id_platform_format_language_version_key'
  ) then
    alter table public.derivative_posts drop constraint derivative_posts_parent_article_id_platform_format_language_version_key;
  end if;
end $$;

create index if not exists platform_specs_platform_idx on public.platform_specs(platform, format);
create index if not exists platform_content_rules_platform_idx on public.platform_content_rules(platform, enabled, language_version);
create index if not exists derivative_posts_parent_idx on public.derivative_posts(parent_article_id, created_at desc);
create index if not exists derivative_posts_generation_idx on public.derivative_posts(generation_id, created_at desc);

alter table public.platform_specs enable row level security;
alter table public.platform_content_rules enable row level security;
alter table public.derivative_posts enable row level security;
revoke all on table public.platform_specs, public.platform_content_rules, public.derivative_posts from public, anon, authenticated;
grant select, insert, update, delete on table public.platform_specs, public.platform_content_rules, public.derivative_posts to service_role;

-- Seeds are insert-only so rerunning the script never overwrites edits made in the webpage.
insert into public.platform_specs
  (platform, format, max_text_length, title_max_length, image_aspect_ratios, image_dimensions, carousel_max, hashtag_guidance, video_duration, video_aspect_ratios, max_file_size, ai_label_requirement, source_urls, checked_at, status, field_status, notes)
values
('Threads','單則文字貼文',500,null,'{}',null,null,'未找到官方數量規範',null,'{}',null,'Meta 說明可依其偵測到的產業標準訊號標示 AI 生成影像；適用範圍待人工確認。',array['https://about.fb.com/news/2023/07/introducing-threads-new-app-text-sharing/','https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/'],'2026-10-07','pending_manual_review','{"max_text_length":"official_source","other_fields":"pending_manual_review"}'::jsonb,'Meta 2023 新聞稿明示單則文字貼文上限 500 字；API 字元計算與當前產品差異待確認。'),
('Threads','串文',500,null,'{}',null,null,'未找到官方數量規範',null,'{}',null,'Meta 說明可依其偵測到的產業標準訊號標示 AI 生成影像；適用範圍待人工確認。',array['https://about.fb.com/news/2023/07/introducing-threads-new-app-text-sharing/','https://about.fb.com/news/2025/09/attach-text-threads-posts-share-longer-perspectives/','https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/'],'2026-10-07','pending_manual_review','{"per_post_text":"official_source","thread_count":"pending_manual_review","attachment_text":"official_source_10000_characters"}'::jsonb,'Meta 2025 新聞稿另載可附加最多 10,000 字文字；不是串文篇數上限。'),
('IG','貼文',null,null,'{}',null,null,'未找到官方數量規範',null,'{}',null,'Meta 說明可依其偵測到的產業標準訊號標示 AI 生成影像；適用範圍待人工確認。',array['https://help.instagram.com/','https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/'],'2026-10-07','pending_manual_review','{"all_fields":"pending_manual_review"}'::jsonb,'尚未在可讀官方來源確認一般貼文文字、圖片比例、尺寸、檔案大小或標籤數量。'),
('IG','輪播',null,null,'{}',null,null,'未找到官方數量規範',null,'{}',null,'Meta 說明可依其偵測到的產業標準訊號標示 AI 生成影像；適用範圍待人工確認。',array['https://help.instagram.com/','https://www.socialmediatoday.com/news/instagram-expands-carousels-to-20-frames/723792/','https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/'],'2026-10-07','pending_manual_review','{"carousel_max":"secondary_source_only_pending","other_fields":"pending_manual_review"}'::jsonb,'二手報導指向 20 張上限，但此處未找到可直接核對的官方頁面，故不標為已查證。'),
('IG','Reel',null,null,'{}',null,null,'未找到官方數量規範',null,'{}',null,'Meta 說明可依其偵測到的產業標準訊號標示 AI 生成影像；適用範圍待確認。',array['https://help.instagram.com/','https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/'],'2026-10-07','pending_manual_review','{"all_fields":"pending_manual_review"}'::jsonb,'影片時間、比例與上傳限制待官方來源確認。'),
('IG','Reel 封面',null,null,'{}',null,null,'不適用',null,'{}',null,'若封面含 AI 生成影像，Meta 可能依偵測訊號加上 AI Info；待人工確認。',array['https://help.instagram.com/','https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/'],'2026-10-07','pending_manual_review','{"all_fields":"pending_manual_review"}'::jsonb,'封面尺寸與安全區待官方來源確認。'),
('YT','Shorts',null,100,'{}',null,null,'未找到官方數量建議', '最長 180 秒','方形或直式',null,'需對看起來真實且經 AI 重大改造或生成的內容揭露；AI 文案／大綱輔助通常不需揭露。',array['https://support.google.com/youtube/answer/15424877','https://support.google.com/youtube/answer/14328491?hl=en-GB','https://developers.google.com/youtube/v3/docs/videos'],'2026-10-07','pending_manual_review','{"title_max_length":"official_api_100_chars","duration":"official_180_seconds","aspect_ratio":"official_square_or_vertical","description_bytes":"official_api_5000_bytes","hashtag_guidance":"pending_manual_review"}'::jsonb,'YouTube Help 明示 Shorts 可至 3 分鐘且方形或直式；API 標題 100 字、說明 5000 bytes。'),
('YT','長片文字稿綱',null,100,'{}',null,null,'未找到官方數量建議',null,'{}',null,'需對看起來真實且經 AI 重大改造或生成的內容揭露；AI 文案／大綱輔助通常不需揭露。',array['https://developers.google.com/youtube/v3/docs/videos','https://support.google.com/youtube/answer/14328491?hl=en-GB'],'2026-10-07','pending_manual_review','{"title_max_length":"official_api_100_chars","description_bytes":"official_api_5000_bytes","thumbnail_dimensions":"api_resource_examples_only","chapters":"timestamps_supported","hashtag_guidance":"pending_manual_review"}'::jsonb,'長片標題與說明 API 上限有官方文件；章節以說明中的時間戳呈現。縮圖文字、縮圖檔案限制與標籤數待確認。'),
('YT','長片縮圖文字',null,null,'{}','API 回傳的 maxres 縮圖樣例 1280×720，非上傳規格確認',null,'不適用',null,'{}',null,'縮圖生成文字／大綱屬輔助創作；若縮圖含逼真合成內容，仍須依官方 AI 揭露規則判斷。',array['https://developers.google.com/youtube/v3/docs/videos','https://support.google.com/youtube/answer/14328491?hl=en-GB'],'2026-10-07','pending_manual_review','{"dimension":"api_response_example_not_upload_requirement","file_size":"pending_manual_review"}'::jsonb,'以純文字交付縮圖文字，不生成縮圖圖片。'),
('小紅書','圖文筆記',null,null,'{}',null,null,'未找到官方數量規範',null,'{}',null,'社區公約建議 AI 生成或 AI 潤色內容盡可能清楚說明；是否必須及標註位置待人工確認。',array['https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],'2026-10-07','pending_manual_review','{"ai_label":"official_recommendation_not_requirement","other_fields":"pending_manual_review"}'::jsonb,'可讀官方社區公約含 AI 輔助內容標明建議；格式規格仍待人工確認。'),
('小紅書','動態圖文',null,null,'{}',null,null,'未找到官方數量規範',null,'{}',null,'社區公約建議 AI 生成或 AI 潤色內容盡可能清楚說明；是否必須及標註位置待人工確認。',array['https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],'2026-10-07','pending_manual_review','{"ai_label":"official_recommendation_not_requirement","other_fields":"pending_manual_review"}'::jsonb,'動態圖文與圖文筆記的技術限制待人工確認。'),
('抖音','圖文',null,null,'{}',null,null,'未找到官方數量規範',null,'{}',null,'抖音協議要求可能造成混淆的非真實音視頻以顯著方式標識；文字／圖文場景適用範圍待人工確認。',array['https://www.douyin.com/agreements/?id=6773906068725565448&ug_source=sem_baidu','https://trust.douyin.com/','https://www.cac.gov.cn/2025-03/14/c_1743654685899683.htm'],'2026-10-07','pending_manual_review','{"ai_label":"official_agreement_and_regulation_scope_pending","other_fields":"pending_manual_review"}'::jsonb,'技術規格均待人工確認；AI 標註只保留待確認提醒。'),
('抖音','動態圖文影片',null,null,'{}',null,null,'未找到官方數量規範',null,'{}',null,'抖音協議要求可能造成混淆的非真實音視頻以顯著方式標識；另有 AI 內容標識功能，具體操作待人工確認。',array['https://www.douyin.com/agreements/?id=6773906068725565448&ug_source=sem_baidu','https://trust.douyin.com/','https://www.cac.gov.cn/2025-03/14/c_1743654685899683.htm'],'2026-10-07','pending_manual_review','{"ai_label":"official_agreement_and_regulation_scope_pending","other_fields":"pending_manual_review"}'::jsonb,'時長、比例、檔案大小、文字限制與標籤數均待官方來源確認。')
on conflict (platform, format) do nothing;

-- User-requested conservative filters. Every row remains pending manual confirmation and is not a legal conclusion.
insert into public.platform_content_rules (platform, category, language_version, description, blocked_terms, source_urls, enabled, block_available, status)
values
('小紅書','命理與玄學','zh-TW','使用者設定的科普頻道紅線，非平台政策定論。',array['命理','命理師','算命','占卜','運勢','八字','生辰','星座預測','風水','玄學','通靈','改運','開運','轉運','消災','化解','宿命','預測未來','前世今生','靈性','靈魂','能量','能量場','磁場','信息場','調頻','頻率','療癒','療癒師','生命靈數'],array['https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],true,true,'pending_manual_review'),
('小紅書','命理與玄學','zh-CN','用户设置的科普频道红线，非平台政策结论。',array['命理','命理师','算命','占卜','运势','八字','生辰','星座预测','风水','玄学','通灵','改运','开运','转运','消灾','化解','宿命','预测未来','前世今生','灵性','灵魂','能量','能量场','磁场','信息场','调频','频率','疗愈','疗愈师','生命灵数'],array['https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],true,true,'pending_manual_review'),
('抖音','命理與玄學','zh-TW','使用者設定的科普頻道紅線，非平台政策定論。',array['命理','命理師','算命','占卜','運勢','八字','生辰','星座預測','風水','玄學','通靈','改運','開運','轉運','消災','化解','宿命','預測未來','前世今生','靈性','靈魂','能量','能量場','磁場','信息場','調頻','頻率','療癒','療癒師','生命靈數'],array['https://trust.douyin.com/','https://lf3-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/douyin_creator/40db1b96-0eb0-4754-a052-16e8325af350.html'],true,true,'pending_manual_review'),
('抖音','命理與玄學','zh-CN','用户设置的科普频道红线，非平台政策结论。',array['命理','命理师','算命','占卜','运势','八字','生辰','星座预测','风水','玄学','通灵','改运','开运','转运','消灾','化解','宿命','预测未来','前世今生','灵性','灵魂','能量','能量场','磁场','信息场','调频','频率','疗愈','疗愈师','生命灵数'],array['https://trust.douyin.com/','https://lf3-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/douyin_creator/40db1b96-0eb0-4754-a052-16e8325af350.html'],true,true,'pending_manual_review'),
('小紅書','療效與醫療','zh-TW','使用者設定的科普頻道紅線，非平台政策定論。',array['治療','治癒','療效','根治','改善疾病','抑鬱症','焦慮症','失眠治療','處方','藥','代替就醫','醫生','心理治療師'],array['https://pgy.xiaohongshu.com/help/detail?id=6495c527d1eedeeb48fb18b1f875650e&userType=4','https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],true,true,'pending_manual_review'),
('小紅書','療效與醫療','zh-CN','用户设置的科普频道红线，非平台政策结论。',array['治疗','治愈','疗效','根治','改善疾病','抑郁症','焦虑症','失眠治疗','处方','药','代替就医','医生','心理治疗师'],array['https://pgy.xiaohongshu.com/help/detail?id=6495c527d1eedeeb48fb18b1f875650e&userType=4','https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],true,true,'pending_manual_review'),
('抖音','療效與醫療','zh-TW','使用者設定的科普頻道紅線，非平台政策定論。',array['治療','治癒','療效','根治','改善疾病','抑鬱症','焦慮症','失眠治療','處方','藥','代替就醫','醫生','心理治療師'],array['https://trust.douyin.com/','https://lf3-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/douyin_creator/40db1b96-0eb0-4754-a052-16e8325af350.html'],true,true,'pending_manual_review'),
('抖音','療效與醫療','zh-CN','用户设置的科普频道红线，非平台政策结论。',array['治疗','治愈','疗效','根治','改善疾病','抑郁症','焦虑症','失眠治疗','处方','药','代替就医','医生','心理治疗师'],array['https://trust.douyin.com/','https://lf3-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/douyin_creator/40db1b96-0eb0-4754-a052-16e8325af350.html'],true,true,'pending_manual_review'),
('小紅書','絕對化與承諾','zh-TW','使用者設定的保守用語攔截，非平台政策定論。',array['保證','一定會','100%','立刻見效','徹底改變','最有效','第一','暴富','躺賺'],array['https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],true,true,'pending_manual_review'),
('小紅書','絕對化與承諾','zh-CN','用户设置的保守用语拦截，非平台政策结论。',array['保证','一定会','100%','立刻见效','彻底改变','最有效','第一','暴富','躺赚'],array['https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],true,true,'pending_manual_review'),
('抖音','絕對化與承諾','zh-TW','使用者設定的保守用語攔截，非平台政策定論。',array['保證','一定會','100%','立刻見效','徹底改變','最有效','第一','暴富','躺賺'],array['https://trust.douyin.com/','https://lf3-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/douyin_creator/40db1b96-0eb0-4754-a052-16e8325af350.html'],true,true,'pending_manual_review'),
('抖音','絕對化與承諾','zh-CN','用户设置的保守用语拦截，非平台政策结论。',array['保证','一定会','100%','立刻见效','彻底改变','最有效','第一','暴富','躺赚'],array['https://trust.douyin.com/','https://lf3-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/douyin_creator/40db1b96-0eb0-4754-a052-16e8325af350.html'],true,true,'pending_manual_review'),
('小紅書','站外導流與交易','zh-TW','使用者設定的保守用語攔截，非平台政策定論。',array['微信','vx','加V','手機號碼','二維碼','私聊領取','站外連結','課程報名連結','價格','優惠'],array['https://pgy.xiaohongshu.com/help/detail?id=1e77b1987d1646def00d556d9879f19f&userType=4'],true,true,'pending_manual_review'),
('小紅書','站外導流與交易','zh-CN','用户设置的保守用语拦截，非平台政策结论。',array['微信','vx','加V','手机号','二维码','私聊领取','站外链接','课程报名链接','价格','优惠'],array['https://pgy.xiaohongshu.com/help/detail?id=1e77b1987d1646def00d556d9879f19f&userType=4'],true,true,'pending_manual_review'),
('抖音','站外導流與交易','zh-TW','使用者設定的保守用語攔截，非平台政策定論。',array['微信','vx','加V','手機號碼','二維碼','私聊領取','站外連結','課程報名連結','價格','優惠'],array['https://trust.douyin.com/','https://www.douyin.com/agreements/?id=6773906068725565448&ug_source=sem_baidu'],true,true,'pending_manual_review'),
('抖音','站外導流與交易','zh-CN','用户设置的保守用语拦截，非平台政策结论。',array['微信','vx','加V','手机号','二维码','私聊领取','站外链接','课程报名链接','价格','优惠'],array['https://trust.douyin.com/','https://www.douyin.com/agreements/?id=6773906068725565448&ug_source=sem_baidu'],true,true,'pending_manual_review'),
('小紅書','恐嚇與焦慮製造','zh-TW','使用者設定的保守用語攔截，非平台政策定論。',array['不這樣做就會','再不改變就晚了'],array['https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],true,true,'pending_manual_review'),
('小紅書','恐嚇與焦慮製造','zh-CN','用户设置的保守用语拦截，非平台政策结论。',array['不这样做就会','再不改变就晚了'],array['https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],true,true,'pending_manual_review'),
('抖音','恐嚇與焦慮製造','zh-TW','使用者設定的保守用語攔截，非平台政策定論。',array['不這樣做就會','再不改變就晚了'],array['https://trust.douyin.com/','https://lf3-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/douyin_creator/40db1b96-0eb0-4754-a052-16e8325af350.html'],true,true,'pending_manual_review'),
('抖音','恐嚇與焦慮製造','zh-CN','用户设置的保守用语拦截，非平台政策结论。',array['不这样做就会','再不改变就晚了'],array['https://trust.douyin.com/','https://lf3-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/douyin_creator/40db1b96-0eb0-4754-a052-16e8325af350.html'],true,true,'pending_manual_review'),
('小紅書','未證實專業資格','zh-TW','不得自稱未經證實的醫療或心理專業資格。',array['自稱醫生','自稱心理治療師','心理治療師資格','精神科醫師','我是醫生','我是心理治療師','我是心理師','我是心理學家','我是諮商師','臨床心理師','諮商心理師'],array['https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],true,true,'pending_manual_review'),
('小紅書','未證實專業資格','zh-CN','不得自称未经证实的医疗或心理专业资格。',array['自称医生','自称心理治疗师','心理治疗师资格','精神科医师','我是医生','我是心理治疗师','我是心理师','我是心理学家','我是咨询师','临床心理师','咨询心理师'],array['https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'],true,true,'pending_manual_review'),
('抖音','未證實專業資格','zh-TW','不得自稱未經證實的醫療或心理專業資格。',array['自稱醫生','自稱心理治療師','心理治療師資格','精神科醫師','我是醫生','我是心理治療師','我是心理師','我是心理學家','我是諮商師','臨床心理師','諮商心理師'],array['https://trust.douyin.com/'],true,true,'pending_manual_review'),
('抖音','未證實專業資格','zh-CN','不得自称未经证实的医疗或心理专业资格。',array['自称医生','自称心理治疗师','心理治疗师资格','精神科医师','我是医生','我是心理治疗师','我是心理师','我是心理学家','我是咨询师','临床心理师','咨询心理师'],array['https://trust.douyin.com/'],true,true,'pending_manual_review')
on conflict (platform, category, language_version) do nothing;
