/**
 * Sequential Zoho webhook worker.
 * Claims pending webhook_jobs one-by-one and processes via zoho-status-webhook.
 *
 * Deploy:
 *   supabase functions deploy webhook-worker --no-verify-jwt --project-ref lprcdmwlrrukuhqdekah
 *
 * Call (service role):
 *   POST { "action": "drain", "limit": 10 }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, service: "webhook-worker" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "missing env" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = String(body.action || "drain");
  const limit = Math.min(Math.max(Number(body.limit) || 8, 1), 30);
  const sb = createClient(supabaseUrl, serviceKey);

  // Reset stuck processing (> 5 min)
  try {
    await sb.rpc("reset_stuck_webhook_jobs", { p_minutes: 5 });
  } catch {
    await sb
      .from("webhook_jobs")
      .update({
        status: "pending",
        available_at: new Date().toISOString(),
        last_error: "reset stuck (no rpc)",
        started_at: null,
      })
      .eq("status", "processing")
      .lt("started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());
  }

  if (action === "reset_stuck") {
    return new Response(JSON.stringify({ ok: true, action: "reset_stuck" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<Record<string, unknown>> = [];
  let processed = 0;

  for (let i = 0; i < limit; i++) {
    let job: Record<string, unknown> | null = null;

    // Prefer RPC claim
    try {
      const { data: claimed, error } = await sb.rpc("claim_webhook_job");
      if (!error && claimed && (claimed as { id?: number }).id) {
        job = claimed as Record<string, unknown>;
      }
    } catch {
      /* fallback below */
    }

    if (!job) {
      const { data: rows } = await sb
        .from("webhook_jobs")
        .select("*")
        .eq("status", "pending")
        .lte("available_at", new Date().toISOString())
        .order("id", { ascending: true })
        .limit(1);
      if (!rows || !rows.length) break;
      job = rows[0] as Record<string, unknown>;
      await sb
        .from("webhook_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          attempts: (Number(job.attempts) || 0) + 1,
        })
        .eq("id", job.id)
        .eq("status", "pending");
    }

    const jobId = job.id as number;
    const processUrl = `${supabaseUrl}/functions/v1/zoho-status-webhook`;

    try {
      const res = await fetch(processUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "x-process-from-queue": "1",
          "x-queue-job-id": String(jobId),
        },
        body: JSON.stringify({
          action: "process_queued_job",
          job_id: jobId,
          _process_from_queue: true,
        }),
      });
      const text = await res.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text.slice(0, 300) };
      }

      if (!res.ok || parsed.code === 1) {
        const attempts = Number(job.attempts) || 1;
        const maxAttempts = Number(job.max_attempts) || 8;
        const errMsg = String(parsed.error || text).slice(0, 500);
        const dead = attempts >= maxAttempts;
        const backoffSec = Math.min(900, 15 * Math.pow(2, Math.min(attempts, 6)));
        await sb
          .from("webhook_jobs")
          .update({
            status: dead ? "dead" : "pending",
            available_at: new Date(Date.now() + backoffSec * 1000).toISOString(),
            last_error: errMsg,
            started_at: null,
            finished_at: dead ? new Date().toISOString() : null,
            result: parsed,
          })
          .eq("id", jobId);
        results.push({ id: jobId, ok: false, error: errMsg, dead });
      } else {
        // process path usually marks done; ensure done
        await sb
          .from("webhook_jobs")
          .update({
            status: "done",
            finished_at: new Date().toISOString(),
            result: parsed,
            last_error: null,
          })
          .eq("id", jobId)
          .neq("status", "done");
        results.push({ id: jobId, ok: true, matched: parsed.matched, order_id: parsed.order_id });
        processed++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const attempts = Number(job.attempts) || 1;
      const maxAttempts = Number(job.max_attempts) || 8;
      const dead = attempts >= maxAttempts;
      await sb
        .from("webhook_jobs")
        .update({
          status: dead ? "dead" : "pending",
          available_at: new Date(Date.now() + 60_000).toISOString(),
          last_error: msg.slice(0, 500),
          started_at: null,
        })
        .eq("id", jobId);
      results.push({ id: jobId, ok: false, error: msg });
    }

    // Pace Zoho token usage
    await sleep(400);
  }

  return new Response(
    JSON.stringify({ ok: true, processed, results, limit }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
