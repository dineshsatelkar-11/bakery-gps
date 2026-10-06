/**
 * IBCAB — send failure alert email (Gmail SMTP).
 * Secrets (Supabase Edge Function secrets — never commit):
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   SMTP_USER=itsbakedpune5@gmail.com
 *   SMTP_PASS=<Gmail App Password>
 *   ALERT_FROM=itsbakedpune5@gmail.com
 *   ALERT_TO=itsbakedpune5@gmail.com
 */
import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "POST only" });
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const stage = String(body.stage || body.type || "unknown").trim();
    const subjectIn = String(body.subject || "").trim();
    const error = String(body.error || body.message || body.err || "").trim();
    const orderId = body.order_id != null ? String(body.order_id) : "";
    const shop = String(body.shop_name || body.shop || "").trim();
    const zohoIdApp = String(body.zoho_id_app || body.app_zoho_id || "").trim();
    const zohoIdZoho = String(body.zoho_id_zoho || body.zoho_id || "").trim();
    const zohoNumApp = String(body.zoho_number_app || body.app_number || "").trim();
    const zohoNumZoho = String(body.zoho_number_zoho || body.zoho_number || "").trim();
    const logs = body.logs != null ? String(body.logs) : "";
    const extra =
      body.details != null
        ? typeof body.details === "string"
          ? body.details
          : JSON.stringify(body.details, null, 2)
        : "";

    const host = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const port = parseInt(Deno.env.get("SMTP_PORT") || "465", 10) || 465;
    const user = Deno.env.get("SMTP_USER") || Deno.env.get("ALERT_FROM") || "";
    const pass = Deno.env.get("SMTP_PASS") || "";
    const from =
      Deno.env.get("ALERT_FROM") || user || "itsbakedpune5@gmail.com";
    const to =
      Deno.env.get("ALERT_TO") ||
      from ||
      "itsbakedpune5@gmail.com";

    if (!user || !pass) {
      console.warn("[send-failure-alert] SMTP_USER / SMTP_PASS not configured");
      return json(500, {
        ok: false,
        error: "SMTP not configured — set SMTP_USER and SMTP_PASS secrets",
      });
    }

    const subject =
      subjectIn ||
      `[IBCAB] ${stage}${orderId ? " · order " + orderId : ""}${
        shop ? " · " + shop : ""
      }`;

    const lines = [
      "IBCAB failure alert",
      "===================",
      "Time: " + new Date().toISOString(),
      "Stage: " + stage,
      orderId ? "Order id: " + orderId : "",
      shop ? "Shop: " + shop : "",
      zohoNumApp ? "App invoice/challan #: " + zohoNumApp : "",
      zohoIdApp ? "App Zoho id: " + zohoIdApp : "",
      zohoNumZoho ? "Zoho invoice/challan #: " + zohoNumZoho : "",
      zohoIdZoho ? "Zoho id: " + zohoIdZoho : "",
      error ? "Error: " + error : "",
      logs ? "Logs:\n" + logs : "",
      extra ? "Details:\n" + extra : "",
    ].filter(Boolean);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: `"IBCAB Alerts" <${from}>`,
      to,
      subject: subject.slice(0, 200),
      text: lines.join("\n"),
    });

    console.log(
      "[send-failure-alert] sent stage=",
      stage,
      "order=",
      orderId,
      "messageId=",
      info.messageId,
    );

    return json(200, { ok: true, messageId: info.messageId || null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-failure-alert]", msg);
    return json(500, { ok: false, error: msg });
  }
});
