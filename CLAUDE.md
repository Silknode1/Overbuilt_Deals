# Overbuilt Deals — notes for Claude
- Prices are files, not DB rows: `public/data/deals.json` (snapshot) and `data/history/` (append-only). Never rewrite history files.
- Scoring rules live in `pipeline/build.py`; taste priors in `pipeline/model.py` (PRIOR) and the learner in `lib/model.ts`. Keep the `band()` and feature-key formats identical across these and `supabase/functions/notify`.
- Supabase project `tdbcxjnvcgfbxjqluszn` (overbuilt) holds only learning_state, push_subscriptions, push_log, app_secrets, app_public. RLS limits writes to emails in `owners`. Keep personal emails out of this public repo.
- Before reporting done: `npx tsc --noEmit && npm run build`.
