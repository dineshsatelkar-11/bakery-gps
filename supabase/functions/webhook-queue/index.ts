/**
 * Admin API for Zoho webhook queue dashboard.
 * Deploy: supabase functions deploy webhook-queue --no-verify-jwt --project-ref lprcdmwlrrukuhqdekah
 *
 * POST actions:
 *   stats | list | drain | reset_stuck | retry | delete | delete_done
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
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

  const action = String(body.action || "stats");
  const sb = createClient(supabaseUrl, serviceKey);

  if (action === "stats") {
    const todayOnly = body.today_only === true;
    try {
      const { data, error } = await sb.rpc("webhook_jobs_stats", {
        p_today_only: todayOnly,
      });
      if (!error && data) {
        return new Response(JSON.stringify({ ok: true, stats: data }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      /* fallback */
    }
    let q = sb.from("webhook_jobs").select("status, created_at");
    const { data: rows } = await q.limit(5000);
    const list = rows || [];
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const stats = {
      pending: 0,
      processing: 0,
      done: 0,
      failed: 0,
      dead: 0,
      total: list.length,
      today: 0,
    };
    for (const r of list) {
      const st = String((r as { status?: string }).status || "");
      if (st in stats) (stats as Record<string, number>)[st]++;
      const ca = (r as { created_at?: string }).created_at;
      if (ca && new Date(ca) >= startToday) stats.today++;
    }
    return new Response(JSON.stringify({ ok: true, stats }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "list") {
    const status = body.status ? String(body.status) : "";
    const todayOnly = body.today_only === true;
    const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 500);
    let q = sb
      .from("webhook_jobs")
      .select(
        "id,source,event_type,order_id,shop_name,zoho_doc_id,zoho_doc_number,reference_number,status,attempts,max_attempts,last_error,created_at,available_at,started_at,finished_at,result",
      )
      .order("id", { ascending: false })
      .limit(limit);
    if (status && status !== "all") q = q.eq("status", status);
    if (todayOnly) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      q = q.gte("created_at", start.toISOString());
    }
    const { data, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, rows: data || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "drain" || action === "run_worker") {
    const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 30);
    const workerUrl = `${supabaseUrl}/functions/v1/webhook-worker`;
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ action: "drain", limit }),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return new Response(JSON.stringify({ ok: res.ok, worker: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "reset_stuck") {
    try {
      const { data } = await sb.rpc("reset_stuck_webhook_jobs", { p_minutes: 5 });
      return new Response(JSON.stringify({ ok: true, reset: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      const { data, error } = await sb
        .from("webhook_jobs")
        .update({
          status: "pending",
          available_at: new Date().toISOString(),
          last_error: "manual reset stuck",
          started_at: null,
        })
        .eq("status", "processing")
        .select("id");
      return new Response(
        JSON.stringify({ ok: !error, reset: (data || []).length, error: error?.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  if (action === "retry") {
    const id = Number(body.id);
    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error } = await sb
      .from("webhook_jobs")
      .update({
        status: "pending",
        available_at: new Date().toISOString(),
        last_error: null,
        started_at: null,
        finished_at: null,
      })
      .eq("id", id);
    return new Response(JSON.stringify({ ok: !error, error: error?.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "retry_failed") {
    const { data, error } = await sb
      .from("webhook_jobs")
      .update({
        status: "pending",
        available_at: new Date().toISOString(),
        last_error: null,
        started_at: null,
      })
      .in("status", ["failed", "dead"])
      .select("id");
    return new Response(
      JSON.stringify({ ok: !error, count: (data || []).length, error: error?.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (action === "delete") {
    const id = Number(body.id);
    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error } = await sb.from("webhook_jobs").delete().eq("id", id);
    return new Response(JSON.stringify({ ok: !error, error: error?.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "delete_done" || action === "delete_history") {
    const days = Math.max(Number(body.days) || 0, 0);
    const todayOnly = body.today_only === true;
    let q = sb.from("webhook_jobs").delete().in("status", ["done", "failed", "dead"]);
    if (todayOnly) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      q = q.gte("created_at", start.toISOString());
    } else if (days > 0) {
      const cutoff = new Date(Date.now() - days * 86400000);
      q = q.lt("created_at", cutoff.toISOString());
    }
    // If days=0 and not todayOnly → delete all done/failed/dead
    const { data, error } = await q.select("id");
    return new Response(
      JSON.stringify({
        ok: !error,
        deleted: (data || []).length,
        error: error?.message,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ error: "unknown action", action }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
