# Zoho `attach_document` — merge into `zoho-token` edge function

When admin confirms payment with a customer screenshot, the app calls:

```json
{
  "action": "attach_document",
  "access_token": "...",
  "org_id": "...",
  "dc": "in",
  "entity": "invoices",
  "entity_id": "ZOHO_INVOICE_ID",
  "file_url": "https://drive.google.com/...",
  "file_name": "payment-proof-123.jpg"
}
```

Also used with `"entity": "customerpayments"` after payment is created.

## Handler to add inside zoho-token switch/if

```javascript
if (action === "attach_document") {
  const entity = String(body.entity || "invoices").replace(/[^a-z]/gi, "");
  const entityId = String(body.entity_id || "");
  const fileUrl = String(body.file_url || "");
  const fileName = String(body.file_name || "payment-proof.jpg");
  const token = body.access_token;
  const orgId = body.org_id;
  const dc = body.dc || "in";
  if (!entityId || !fileUrl || !token || !orgId) {
    return json({ code: 1, message: "entity_id, file_url, access_token, org_id required" });
  }
  // Download proof image (Drive public/exec URL)
  const fileRes = await fetch(fileUrl, { redirect: "follow" });
  if (!fileRes.ok) {
    return json({ code: 1, message: "Could not download file_url: " + fileRes.status });
  }
  const bytes = await fileRes.arrayBuffer();
  const contentType = fileRes.headers.get("content-type") || "image/jpeg";
  const form = new FormData();
  form.append(
    "attachment",
    new Blob([bytes], { type: contentType }),
    fileName
  );
  const host =
    dc === "com" ? "www.zohoapis.com" :
    dc === "eu" ? "www.zohoapis.eu" :
    dc === "au" ? "www.zohoapis.com.au" :
    "www.zohoapis.in";
  // Zoho Books attachment endpoints
  const path =
    entity === "customerpayments"
      ? `/books/v3/customerpayments/${encodeURIComponent(entityId)}/attachment`
      : `/books/v3/invoices/${encodeURIComponent(entityId)}/attachment`;
  const url = `https://${host}${path}?organization_id=${encodeURIComponent(orgId)}`;
  const zohoRes = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    body: form,
  });
  const text = await zohoRes.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text, http_status: zohoRes.status }; }
  data.ok = zohoRes.ok && (data.code === 0 || data.code === undefined);
  data.http_status = zohoRes.status;
  return json(data);
}
```

## Deploy

1. Open your existing **zoho-token** edge function in Supabase Dashboard (or local clone).
2. Paste the `attach_document` branch next to `create_customer_payment`.
3. Redeploy: `supabase functions deploy zoho-token`

Without this branch, payment is still recorded in Zoho; only file attach is skipped (console warning).
