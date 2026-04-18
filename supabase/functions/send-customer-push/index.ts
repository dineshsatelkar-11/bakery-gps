import { createClient } from 'jsr:@supabase/supabase-js@2';
// @ts-ignore
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req: Request) => {
  // Allow CORS from your site
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { shop_ids, message } = await req.json();
    if (!shop_ids || !shop_ids.length || !message) {
      return new Response(JSON.stringify({ error: 'Missing shop_ids or message' }), { status: 400 });
    }

    // Set VAPID details from Supabase secrets
    webpush.setVapidDetails(
      `mailto:${Deno.env.get('VAPID_EMAIL') || 'admin@bakery.com'}`,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!
    );

    // Fetch push subscriptions for the given shop_ids
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('shop_id', shop_ids.map(String));

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: 'No subscriptions found' }), {
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const payload = JSON.stringify({
      title: '🥖 Message from bakery',
      body: message
    });

    // Send push to each subscription, remove expired ones
    const staleEndpoints: string[] = [];
    const results = await Promise.allSettled(
      subs.map((sub: { endpoint: string; p256dh: string; auth: string; shop_id: string }) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch((err: { statusCode?: number }) => {
          // 404/410 means subscription is expired — mark for removal
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          }
          throw err;
        })
      )
    );

    // Clean up expired subscriptions
    if (staleEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', staleEndpoints);
    }

    const sent = results.filter(r => r.status === 'fulfilled').length;
    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
});
