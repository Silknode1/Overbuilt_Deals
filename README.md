# Overbuilt Deals

Over-engineered things, honestly priced. A personal deal engine for EDC, hi-fi audio, backpacks, luggage,
tactical gear, health hardware and gadgets. It checks each deal against its own price history and other
stores, and learns what you like from your ratings.

## How it fits together
```
GitHub Actions (every 3h) ──► pipeline/*.py ──► public/data/deals.json + data/history/*  ──► git push ──► Vercel redeploys
   32 Shopify store feeds + 57 Slickdeals keyword feeds          (your own price history, append-only)

Next.js app (Vercel) ──► reads deals.json · ranks with the taste model (lib/model.ts)
                     └─► Supabase: magic-link sign-in (owner only) · learning_state · push_subscriptions

Supabase pg_cron (every 3h at :45) ──► edge function `notify` ──► web push, max 3/day, genuine lows you'd want
```
No paid APIs: no Keepa, no scraping services. History comes from Slickdeals posts (dated prices per model)
plus our own snapshots, which count as history after 5 days of tracking.

## Run locally
```
npm install
npm run refresh   # pulls feeds and rebuilds public/data/deals.json (Python 3, curl)
npm run dev
```
`.env.production` holds only public values (Supabase URL + publishable key). Nothing secret is in this repo;
the push private key is generated and kept inside Supabase.

## Files
- `pipeline/` — feeds → scoring (`build.py`: real-deal score, fake-discount flags, buy/wait) → slim snapshot (`model.py`: taste priors)
- `lib/model.ts` — taste model: per-feature weights with uncertainty; a "no" moves only what its reason names
- `components/` — UI; `app/api/live` — live price check for tracked Shopify stores
- `supabase/` — schema/RLS/cron migration and the `notify` function
