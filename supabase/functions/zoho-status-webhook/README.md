# zoho-status-webhook

Zoho Books → app automation (no polling).

When an **invoice** or **delivery challan** is created/edited in Zoho:

| Change in Zoho | App update |
|----------------|------------|
| Status (sent / paid / void / partial / …) | `zoho_invoice_status`, `payment_status` |
| Balance / total | `balance_due`, `invoice_total` |
| **Quantity / line items** | Re-fetches full Zoho document → updates `items`, `qty`, `item_ids`, subtotal/tax/total |
| Paid (status or balance ≈ 0) | Marks paid + push notification to customer |

## Deploy

```bash
supabase functions deploy zoho-status-webhook --no-verify-jwt --project-ref lprcdmwlrrukuhqdekah
```

Optional:

```bash
supabase secrets set ZOHO_WEBHOOK_SECRET=your-long-random-string --project-ref lprcdmwlrrukuhqdekah
```

## URL

```
https://lprcdmwlrrukuhqdekah.supabase.co/functions/v1/zoho-status-webhook
```

## Zoho setup (required once)

### 1) Invoice workflow

1. Zoho Books → **Settings → Automation → Workflow Rules**
2. Module: **Invoices**
3. When: **Created** and **Edited** (any edit = status *or* qty change)
4. Action: **Webhook** → Method **POST** → URL above
5. Entity parameters:

| Param | Zoho field |
|-------|------------|
| `invoice_id` | `${Invoice.Invoice ID}` |
| `invoice_number` | `${Invoice.Invoice Number}` |
| `status` | `${Invoice.Status}` |
| `balance` | `${Invoice.Balance}` |
| `total` | `${Invoice.Total}` |
| `reference_number` | `${Invoice.Reference Number}` |
| `doc_type` | `invoice` (plain text) |

### 2) Challan workflow (same URL)

1. Module: **Delivery Challans** (or **Sales Orders** if you use SO as challan)
2. When: **Created** / **Edited**
3. Parameters:

| Param | Field |
|-------|--------|
| `deliverychallan_id` or `salesorder_id` | `${….ID}` |
| `invoice_number` / number | `${….Number}` |
| `status` | `${….Status}` |
| `total` | `${….Total}` |
| `reference_number` | `${….Reference Number}` |
| `doc_type` | `challan` |

If `ZOHO_WEBHOOK_SECRET` is set, add header:

```
X-Webhook-Secret: your-long-random-string
```

## Quantity sync note

Zoho webhooks usually **do not** send full line items.  
This function therefore:

1. Matches your `customer_orders` row (`zoho_invoice_id` → number → `IBCAB-{id}`)
2. Loads Zoho API credentials from **settings** (`zoho_client_id`, `zoho_client_secret`, `zoho_refresh_token`, `zoho_org_id`, `zoho_dc`) — same as Admin → Zoho tab
3. Refreshes access token
4. **GET** full invoice/challan from Zoho
5. Writes `items`, `qty`, `item_ids`, totals into the order

So any qty edit in Zoho updates the app automatically after the workflow fires.

## Test

```bash
# Health
curl 'https://lprcdmwlrrukuhqdekah.supabase.co/functions/v1/zoho-status-webhook'

# Status only
curl -X POST 'https://lprcdmwlrrukuhqdekah.supabase.co/functions/v1/zoho-status-webhook' \
  -H 'Content-Type: application/json' \
  -d '{"invoice_id":"YOUR_ZOHO_ID","status":"paid","balance":0,"total":1000,"reference_number":"IBCAB-123"}'
```

Edit an invoice qty in Zoho → save → check `customer_orders.qty` and totals in the app (or refresh Unpaid/Challan tab).
