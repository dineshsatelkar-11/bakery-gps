-- Zoho webhook job queue (process one-by-one to avoid token rate limits)
-- Run in Supabase SQL editor once.

CREATE TABLE IF NOT EXISTS webhook_jobs (
  id               bigserial PRIMARY KEY,
  source           text NOT NULL DEFAULT 'zoho',
  event_type       text,
  payload          jsonb NOT NULL,
  order_id         bigint,
  shop_name        text,
  zoho_doc_id      text,
  zoho_doc_number  text,
  reference_number text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'done', 'failed', 'dead')),
  attempts         int  NOT NULL DEFAULT 0,
  max_attempts     int  NOT NULL DEFAULT 8,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  available_at     timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  finished_at      timestamptz,
  zoho_history_id  text,
  result           jsonb
);

CREATE INDEX IF NOT EXISTS webhook_jobs_pick_idx
  ON webhook_jobs (status, available_at, id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS webhook_jobs_processing_idx
  ON webhook_jobs (started_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS webhook_jobs_order_idx
  ON webhook_jobs (order_id);

CREATE INDEX IF NOT EXISTS webhook_jobs_doc_number_idx
  ON webhook_jobs (zoho_doc_number);

CREATE INDEX IF NOT EXISTS webhook_jobs_created_idx
  ON webhook_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS webhook_jobs_status_created_idx
  ON webhook_jobs (status, created_at DESC);

COMMENT ON TABLE webhook_jobs IS
  'Inbound Zoho webhooks. Thin edge enqueues; worker processes one-by-one.';

-- Claim next pending job (safe under concurrency)
CREATE OR REPLACE FUNCTION claim_webhook_job()
RETURNS webhook_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job webhook_jobs;
BEGIN
  SELECT *
  INTO job
  FROM webhook_jobs
  WHERE status = 'pending'
    AND available_at <= now()
  ORDER BY id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE webhook_jobs
  SET
    status     = 'processing',
    started_at = now(),
    attempts   = attempts + 1
  WHERE id = job.id
  RETURNING * INTO job;

  RETURN job;
END;
$$;

-- Reset jobs stuck in processing
CREATE OR REPLACE FUNCTION reset_stuck_webhook_jobs(p_minutes int DEFAULT 5)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  n int;
BEGIN
  UPDATE webhook_jobs
  SET
    status       = 'pending',
    available_at = now() + interval '15 seconds',
    last_error   = trim(both FROM coalesce(last_error, '') || ' | reset stuck processing'),
    started_at   = null
  WHERE status = 'processing'
    AND started_at < now() - make_interval(mins => greatest(p_minutes, 1));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Stats helper
CREATE OR REPLACE FUNCTION webhook_jobs_stats(p_today_only boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'pending',    count(*) FILTER (WHERE status = 'pending'),
    'processing', count(*) FILTER (WHERE status = 'processing'),
    'done',       count(*) FILTER (WHERE status = 'done'),
    'failed',     count(*) FILTER (WHERE status = 'failed'),
    'dead',       count(*) FILTER (WHERE status = 'dead'),
    'total',      count(*),
    'today',      count(*) FILTER (
      WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                        AT TIME ZONE 'Asia/Kolkata'
    )
  )
  FROM webhook_jobs
  WHERE (NOT p_today_only)
     OR created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                      AT TIME ZONE 'Asia/Kolkata';
$$;
