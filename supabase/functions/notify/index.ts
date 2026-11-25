// Overbuilt push alerts. Called by pg_cron every 3 hours.
// Reads the latest snapshot from the public repo, scores it with your synced taste profile,
// and pushes at most 3 genuine lows per day that you'd actually want. VAPID private key lives in app_secrets.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SNAPSHOT = "https://raw.githubusercontent.com/Silknode1/overbuilt_deals/main/public/data/deals.json";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const band = (p?: number) => p == null ? "100-500" : p < 40 ? "<40" : p < 100 ? "40-100" : p < 500 ? "100-500" : p < 1500 ? "500-1500" : "1500+";

Deno.serve(async (req) => {
  const { data: secrets } = await sb.from("app_secrets").select("name,value");
  const S = Object.fromEntries((secrets ?? []).map((r) => [r.name, r.value]));
  if (!S.cron_key || req.headers.get("x-cron-key") !== S.cron_key) return new Response("forbidden", { status: 403 });
  if (!S.vapid_private) { // first run: mint VAPID keys inside Supabase so the private key never leaves it
    const k = webpush.generateVAPIDKeys();
    await sb.from("app_secrets").upsert([{ name: "vapid_private", value: k.privateKey }, { name: "vapid_public", value: k.publicKey }]);
    await sb.from("app_public").upsert({ name: "vapid_public", value: k.publicKey });
    S.vapid_private = k.privateKey; S.vapid_public = k.publicKey;
  }
  webpush.setVapidDetails(S.vapid_subject ?? "https://github.com/Silknode1/overbuilt_deals", S.vapid_public, S.vapid_private);

  const snap = await (await fetch(SNAPSHOT)).json();
  const { data: st } = await sb.from("learning_state").select("state").limit(1).maybeSingle();
  const w: Record<string, number> = st?.state?.w ?? {}, owned: string[] = [...snap.prior.owned, ...(st?.state?.owned ?? [])];
  const dismissed = st?.state?.dismiss ?? {};
  const W = (k: string) => {
    if (k in w) return w[k];
    const [g, a, b] = k.split(":");
    return g === "band" ? snap.prior.band[b] ?? 0 : snap.prior[g]?.[a] ?? 0;
  };
  const taste = (d: any) => {
    const ks = [`cat:${d.cat}`, `brand:${d.brand.toLowerCase()}`, `band:${d.cat}:${band(d.price)}`, ...(d.feats ?? []).map((f: string) => `feat:${f}`)];
    if (owned.some((o) => d.title.toLowerCase().includes(o))) ks.push("feat:owned");
    return 1 / (1 + Math.exp(-(snap.prior.bias + ks.reduce((s, k) => s + W(k), 0))));
  };

  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await sb.from("push_log").select("*", { count: "exact", head: true }).gte("sent_at", since);
  const budget = Math.max(0, 3 - (count ?? 0));
  const { data: sentRows } = await sb.from("push_log").select("listing_id");
  const sent = new Set((sentRows ?? []).map((r) => r.listing_id));
  const picks = snap.items
    .filter((d: any) => d.price && d.real >= 80 && !sent.has(d.id) && !dismissed[d.id] && d.cond !== "used")
    .map((d: any) => ({ d, t: taste(d) })).filter((x: any) => x.t >= 0.6)
    .sort((a: any, b: any) => b.t * b.d.real - a.t * a.d.real).slice(0, budget);

  const { data: subs } = await sb.from("push_subscriptions").select("*");
  if (!subs?.length) return Response.json({ picks: [], delivered: 0, note: "no subscriptions yet" });
  let delivered = 0;
  for (const { d } of picks) {
    const payload = JSON.stringify({ id: d.id, title: `${d.brand}: $${d.price}`, body: `${d.title} — ${d.verdict}`, url: d.url });
    for (const s of subs ?? []) {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); delivered++; }
      catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint); }
    }
    await sb.from("push_log").upsert({ listing_id: d.id });
  }
  return Response.json({ picks: picks.map((p: any) => p.d.id), delivered });
});
