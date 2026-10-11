-- 自動流水線：排程時可附品牌圖卡網址（publish_queue.image_url）。
-- 在 Supabase SQL Editor 執行一次。可重複執行。未執行前，程式會自動退回「不附圖卡」，文案照常排程。
drop function if exists public.enqueue_auto_pipeline_job(uuid, text, text);

create or replace function public.enqueue_auto_pipeline_job(
  p_job_id uuid, p_content text, p_target_page text, p_image_url text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare job public.auto_pipeline_jobs%rowtype; v_queue_id uuid;
begin
  select * into job from public.auto_pipeline_jobs where id = p_job_id for update;
  if not found then return null; end if;
  if job.queue_id is not null then return job.queue_id; end if;
  if job.status <> 'optimizing' or job.scheduled_at is null or job.scheduled_at < now() + interval '30 minutes' then return null; end if;
  if p_target_page = 'fb_erick' or p_target_page not in ('fb_nas', 'fb_abl', 'fb_i8') then return null; end if;
  if p_image_url is not null and p_image_url !~ '^https://' then p_image_url := null; end if;
  insert into public.publish_queue (
    brand_id, target_pages, content, image_url, article_id, source, is_test,
    scheduled_at, status, results, test_mode, created_at, updated_at
  ) values (
    job.brand_id, array[p_target_page], p_content, p_image_url, null, 'auto_pipeline', false,
    job.scheduled_at, 'pending', '[]'::jsonb, false, now(), now()
  ) returning id into v_queue_id;
  update public.auto_pipeline_jobs
     set status = 'scheduled', current_step = '已排程，未審', queue_id = v_queue_id,
         draft_content = p_content, error_reason = null, updated_at = now()
   where id = p_job_id;
  return v_queue_id;
end;
$$;
revoke all on function public.enqueue_auto_pipeline_job(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.enqueue_auto_pipeline_job(uuid, text, text, text) to service_role;
