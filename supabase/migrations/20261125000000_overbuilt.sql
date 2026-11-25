-- Overbuilt: Supabase holds only the taste profile and push alerts. Prices live in the repo.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table app_secrets (name text primary key, value text not null);          -- service role only
create table app_public (name text primary key, value text not null);           -- e.g. VAPID public key
create table owners (email text primary key);                                    -- who may sign in and write
create table learning_state (user_id uuid primary key default auth.uid(), state jsonb not null default '{}', updated_at timestamptz default now());
create table push_subscriptions (endpoint text primary key, user_id uuid default auth.uid(), p256dh text, auth text, created_at timestamptz default now());
create table push_log (listing_id text primary key, sent_at timestamptz default now());

alter table app_secrets enable row level security; alter table app_public enable row level security;
alter table owners enable row level security; alter table learning_state enable row level security;
alter table push_subscriptions enable row level security; alter table push_log enable row level security;

create policy read_app_public on app_public for select using (true);
create or replace function is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from owners where email = (auth.jwt() ->> 'email')) $$;
create policy own_state on learning_state for all using (user_id = auth.uid() and is_owner()) with check (user_id = auth.uid() and is_owner());
create policy own_push on push_subscriptions for all using (user_id = auth.uid() and is_owner()) with check (user_id = auth.uid() and is_owner());

-- Owner row is added once in the SQL editor (kept out of this public repo):
--   insert into owners values ('<your email>');
insert into app_secrets(name, value) values ('cron_key', encode(extensions.gen_random_bytes(32), 'hex'));

select cron.schedule('overbuilt-notify', '45 */3 * * *', $$
  select net.http_post(url := 'https://tdbcxjnvcgfbxjqluszn.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-key',(select value from app_secrets where name='cron_key')),
    body := '{}'::jsonb, timeout_milliseconds := 60000) $$);
