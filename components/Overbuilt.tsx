"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DealCard from "./DealCard";
import { CATS, Model, countdown, freshState, money, safeUrl, verdictClass, type Deal, type Reason, type Snapshot, type State } from "@/lib/model";
import { loadLocal, loadRemote, saveLocal, saveRemote, sb } from "@/lib/supabase";
import { enablePush, pushSupported } from "@/lib/push";

type View = "feed" | "calibrate" | "watch" | "brands" | "method";
const VIEWS: View[] = ["feed", "calibrate", "watch", "brands", "method"];
const LABEL: Record<View, string> = { feed: "Feed", calibrate: "Calibrate", watch: "Watchlist", brands: "Brands", method: "Method" };
const CAL_N = 36;

export default function Overbuilt() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const stateRef = useRef<State>(freshState());
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const [view, setView] = useState<View>("feed");
  const [email, setEmail] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deck, setDeck] = useState<Deal[]>([]);
  // feed controls
  const [cat, setCat] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("you");
  const [maxp, setMaxp] = useState(""); const [newOnly, setNewOnly] = useState(false); const [shown, setShown] = useState(30);

  const model = useMemo(() => (snap ? new Model(snap.prior, stateRef.current) : null), [snap]);
  const S = stateRef.current;

  const persist = useCallback(() => {
    saveLocal(stateRef.current);
    saveRemote(stateRef.current);
    bump();
  }, []);

  // boot: data, local state, session, remote state
  useEffect(() => {
    fetch("/data/deals.json").then((r) => r.json()).then(setSnap).catch(() => setErr("Could not load the deal snapshot."));
    const local = loadLocal(); if (local) Object.assign(stateRef.current, { ...freshState(), ...local });
    const h = location.hash.slice(1) as View; if (VIEWS.includes(h)) setView(h);
    const c = sb();
    c?.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setEmail(data.user.email ?? null);
      const remote = await loadRemote();
      if (remote && remote.ratings.length >= stateRef.current.ratings.length) { Object.assign(stateRef.current, { ...freshState(), ...remote }); saveLocal(stateRef.current); }
      else saveRemote(stateRef.current);
      bump();
    });
    const t = setInterval(bump, 30000); // countdowns
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (location.hash.slice(1) !== view) history.replaceState(null, "", "#" + view); window.scrollTo({ top: 0 }); }, [view]);
  useEffect(() => { if (model && view === "calibrate" && !deck.length) setDeck(model.deck(snap!.items)); }, [view, model, deck.length, snap]);

  if (err) return <div className="band"><div className="empty">{err}</div></div>;
  if (!snap || !model) return <div className="band"><div className="empty">Loading deals…</div></div>;
  const items = snap.items;

  // actions
  const rate = (d: Deal, yes: boolean, reason?: Reason, fromCal = false) => {
    model.rate(d, yes, reason);
    if (fromCal) S.calDone.push(d.id);
    else if (!yes && reason && reason !== "later") S.dismiss[d.id] = reason;
    persist();
  };
  const save = (d: Deal) => { if (S.watch[d.id]) delete S.watch[d.id]; else { S.watch[d.id] = Date.now(); model.implicit(d, "save"); } persist(); };
  const open = (d: Deal) => { S.clicks[d.id] = (S.clicks[d.id] ?? 0) + 1; model.implicit(d, "open"); persist(); };
  const cardProps = (d: Deal) => ({ d, m: model, saved: !!S.watch[d.id], onOpen: () => open(d), onSave: () => save(d), onNo: (r: Reason) => rate(d, false, r) });

  // feed list
  const mx = Number(maxp) || Infinity, ql = q.trim().toLowerCase();
  const filtered = items.filter((d) => !S.dismiss[d.id] && (cat === "all" || d.cat === cat) && (d.price ?? 0) <= mx && (!newOnly || d.cond !== "used")
    && (!ql || `${d.title} ${d.brand} ${(d.feats ?? []).join(" ")}`.toLowerCase().includes(ql)));
  const sorters: Record<string, (a: Deal, b: Deal) => number> = {
    real: (a, b) => b.real - a.real || model.score(b) - model.score(a),
    ends: (a, b) => (a.ends ? +new Date(a.ends) : 9e15) - (b.ends ? +new Date(b.ends) : 9e15) || model.score(b) - model.score(a),
    low: (a, b) => Number(b.verdict.startsWith("Lowest")) - Number(a.verdict.startsWith("Lowest")) || model.score(b) - model.score(a),
    price: (a, b) => (a.price ?? 9e9) - (b.price ?? 9e9),
  };
  const list: [Deal, boolean][] = sort === "you" ? model.rank(filtered, S.explore) : [...filtered].sort(sorters[sort]).map((d) => [d, false]);
  const ranked = items.filter((d) => !S.dismiss[d.id] && d.price != null).sort((a, b) => model.score(b) - model.score(a));
  const top = ranked[0];
  const lows = ranked.filter((d) => d.real >= 75).slice(0, 5);
  const catCounts = items.reduce<Record<string, number>>((m, d) => ((m[d.cat] = (m[d.cat] ?? 0) + 1), m), {});

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const addr = new FormData(e.currentTarget).get("email") as string;
    const { error } = (await sb()?.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: location.origin, shouldCreateUser: true } })) ?? {};
    setToast(error ? error.message : "Check your email for the sign-in link.");
  }

  const calLeft = deck.filter((d) => !S.calDone.includes(d.id));
  const calDone = Math.min(CAL_N, S.calDone.length);

  return (
    <>
      <header className="top">
        <div className="logo">
          <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" /><path d="M16 3v6M16 23v6M3 16h6M23 16h6" stroke="currentColor" strokeWidth="2.5" /><circle cx="16" cy="16" r="4" fill="#ff5a1f" /></svg>
          Overbuilt
        </div>
        <nav>
          {VIEWS.map((v) => (
            <button key={v} aria-current={view === v} onClick={() => setView(v)}>
              {LABEL[v]}{v === "watch" && Object.keys(S.watch).length ? <span className="num"> {Object.keys(S.watch).length}</span> : null}
            </button>
          ))}
        </nav>
      </header>
      <div className="events">
        {snap.events.filter((e) => +new Date(e.at) > Date.now()).map((e) => <div key={e.name}>{e.name} <b className="cd">{countdown(e.at)}</b></div>)}
      </div>

      <main>
        {view === "feed" && (
          <section>
            <div className="band"><div className="wrap hero">
              <div>
                <h1>Over-engineered things, honestly priced.</h1>
                <p className="lede">Every deal here is measured against its own price history and other retailers, not the &ldquo;was&rdquo; price on the tag. It&apos;s ranked by how much you&apos;d want it, and it learns from every yes, no and click.</p>
                <div className="row">
                  <button className="btn pri" onClick={() => setView("calibrate")}>Calibrate my taste · {CAL_N} cards</button>
                  <span className="small muted">{calDone >= CAL_N ? "Calibrated · keep rating to sharpen it" : calDone ? `${calDone}/${CAL_N} rated` : ""}</span>
                </div>
                <div className="stats">
                  <div><b>{snap.counts.products_scanned.toLocaleString()}</b>products scanned</div>
                  <div><b>{snap.counts.stores}</b>brand stores</div>
                  <div><b>{items.length.toLocaleString()}</b>deals kept</div>
                  <div><b>{S.ratings.length}</b>ratings so far</div>
                </div>
                <div className="lows">
                  <div className="k">Genuine lows worth a look</div>
                  {lows.map((d) => (
                    <a key={d.id} href={safeUrl(d.url)} target="_blank" rel="noopener" onClick={() => open(d)}>
                      <span className="t">{d.title} <span className="muted small">· {d.store}</span><br /><span className={`small ${verdictClass(d.real)}`}>{d.verdict}</span></span>
                      <span className="price" style={{ fontSize: 17 }}>{money(d.price)}</span>
                    </a>
                  ))}
                </div>
              </div>
              {top && <div className="tag big"><span className="hole" /><div className="k">Top pick right now · {CATS[top.cat] ?? top.cat}</div><DealCard {...cardProps(top)} /></div>}
            </div></div>
            <div className="band" style={{ paddingTop: 0 }}><div className="wrap">
              <div className="toolbar">
                <input type="search" placeholder="Search planar, titanium, X-Pac, HD 600…" aria-label="Search deals" value={q} onChange={(e) => { setQ(e.target.value); setShown(30); }} />
                <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="you">For you</option><option value="real">Most genuine</option><option value="ends">Ending soon</option><option value="low">Lowest price seen</option><option value="price">Price, low to high</option>
                </select>
                <select aria-label="Max price" value={maxp} onChange={(e) => setMaxp(e.target.value)}>
                  <option value="">Any price</option>{[100, 250, 500, 1000].map((p) => <option key={p} value={p}>Under ${p}</option>)}
                </select>
                <label className="small row"><input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)} /> New only</label>
                <label className="small row">Explore <input type="range" min={0} max={40} step={5} value={S.explore} aria-label="Exploration share" onChange={(e) => { S.explore = +e.target.value; persist(); }} /> <span className="num">{S.explore}%</span></label>
              </div>
              <div className="row" style={{ marginBottom: 16 }}>
                {[["all", "All", items.length] as const, ...Object.keys(CATS).filter((k) => catCounts[k]).map((k) => [k, CATS[k], catCounts[k]] as const)].map(([k, l, n]) => (
                  <button key={k} className="chip" aria-pressed={cat === k} onClick={() => { setCat(k); setShown(30); }}>{l}{" "}<span className="num muted">{n}</span></button>
                ))}
              </div>
              <div className="grid">
                {list.length ? list.slice(0, shown).map(([d, e]) => <DealCard key={d.id} {...cardProps(d)} explore={e} />) : <div className="empty">Nothing matches these filters.</div>}
              </div>
              {list.length > shown && <div className="row" style={{ justifyContent: "center", marginTop: 18 }}><button className="btn" onClick={() => setShown((s) => s + 30)}>Show more</button></div>}
            </div></div>
          </section>
        )}

        {view === "calibrate" && (
          <section className="band"><div className="wrap cal">
            <div>
              <h2 style={{ fontSize: 34 }}>Calibration run</h2>
              <p className="muted">Yes or no on {CAL_N} real, live deals from across your categories. If it&apos;s a no, tell me why: &ldquo;price too high&rdquo; adjusts what you&apos;ll pay, not whether you like the brand.</p>
              <div className="meter" aria-hidden="true"><i style={{ width: `${(calDone / CAL_N) * 100}%` }} /></div>
              <p className="small muted">{calDone} of {CAL_N} rated</p>
              {calDone >= CAL_N || !calLeft.length ? (
                <div className="empty">Calibration done. Your feed is re-ranked, and saves, opens and dismissals keep teaching it.<br /><br />
                  <button className="btn pri" onClick={() => setView("feed")}>See my feed</button>{" "}
                  <button className="btn" onClick={() => { S.calDone = S.calDone.slice(0, CAL_N - 12); setDeck(model.deck(items)); persist(); }}>Rate 12 more</button>
                </div>
              ) : (
                <DealCard key={calLeft[0].id} d={calLeft[0]} m={model} cal onYes={() => rate(calLeft[0], true, undefined, true)} onNo={(r) => rate(calLeft[0], false, r, true)} />
              )}
            </div>
            <div className="tag"><span className="hole" />
              <h3 style={{ fontSize: 22 }}>What the model believes now</h3>
              <p className="small muted">Starts from your stated tastes and inbox brands, then moves with every rating.</p>
              <div className="prof">
                {model.profile().map(([k, w]) => {
                  const [g, a] = k.split(":"); const pct = Math.min(50, (Math.abs(w) / 2.2) * 50);
                  return (
                    <div className="r" key={k}>
                      <span>{g === "cat" ? CATS[a] ?? a : a} <span className="muted small">{g}</span></span>
                      <span className="bar"><i style={{ [w >= 0 ? "left" : "right"]: "50%", width: `${pct}%`, background: w >= 0 ? "var(--good)" : "var(--bad)" }} /></span>
                      <span className="num small" style={{ textAlign: "right" }}>{w >= 0 ? "+" : ""}{w.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
              <button className="btn ghost small" onClick={() => { Object.assign(S, { ...freshState(), watch: S.watch }); setDeck(model.deck(items)); persist(); }}>Reset learning</button>
            </div>
          </div></section>
        )}

        {view === "watch" && (
          <section className="band"><div className="wrap">
            <h2 style={{ fontSize: 34, marginBottom: 16 }}>Watchlist</h2>
            <div className="grid">
              {items.filter((d) => S.watch[d.id]).map((d) => <DealCard key={d.id} {...cardProps(d)} />)}
              {!Object.keys(S.watch).length && <div className="empty">Tap &ldquo;Want&rdquo; on a deal to track it here. Saving counts as a strong yes.</div>}
            </div>
          </div></section>
        )}

        {view === "brands" && <Brands items={items} model={model} onPick={(b) => { setQ(b); setCat("all"); setView("feed"); }} />}

        {view === "method" && (
          <section className="band"><div className="wrap method">
            <h2 style={{ fontSize: 34 }}>How each deal is measured</h2>
            <p className="muted">Snapshot {new Date(snap.generated).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}. Prices refresh every 3 hours; {snap.counts.slickdeals.toLocaleString()} Slickdeals posts read this run.</p>
            <h3>Account and alerts</h3>
            {email ? <p>Signed in as <b>{email}</b>. Your taste profile syncs across devices.</p> : (
              <form className="signin" onSubmit={signIn}>
                <input name="email" type="email" required placeholder="you@example.com" aria-label="Email" autoComplete="email" />
                <button className="btn pri">Email me a sign-in link</button>
              </form>
            )}
            <p className="small muted">Without signing in, learning is kept in this browser only.</p>
            <div className="row"><button className="btn" disabled={!email || !pushSupported()} onClick={async () => setToast(await enablePush())}>Turn on deal alerts</button>
              <span className="small muted">On iPhone, add Overbuilt to your Home Screen first.</span></div>
            <h3>Where prices come from</h3>
            <ul>
              <li><b>Brand stores:</b> public product feeds from {snap.counts.stores} stores (Sennheiser, Audeze, Apos, Headphones.com, Audio46, GORUCK, Aer, Tom Bihn, Able Carry, The James Brand, Tactile Turn, Nitecore, Sharge, Keychron, BOOX, Hyperice and more): current price, the store&apos;s &ldquo;compare at&rdquo; price and stock.</li>
              <li><b>Amazon, Best Buy, Woot and others:</b> Slickdeals keyword feeds. Every past post for a model becomes a dated price point, and they accumulate run to run.</li>
              <li><b>Our own history:</b> every run logs price changes to the repo. After five days of tracking, the lowest price we&apos;ve seen ourselves counts as history too.</li>
              <li><b>Check live price</b> reads the product straight from the store.</li>
            </ul>
            <h3>Is it a real deal?</h3>
            <p>Score 0–100. At or near the lowest seen scores high; within 10% is &ldquo;good, not the floor&rdquo;; otherwise the card names the lower price and when. A store&apos;s own discount is only a claim until there&apos;s history, so those cap at 70. &ldquo;Was&rdquo; prices over 2.4× the sale price are flagged inflated, a cheaper identical model at another tracked store is called out, and open-box is never compared with new.</p>
            <h3>Will it go lower?</h3>
            <p>A starting heuristic, not a fitted model: category base rates (bags ~10%, EDC ~15%, audio and gadgets ~30–35%) adjusted for distance from the low, discount size and scarcity. Confidence rises as our own history grows.</p>
            <h3>How it learns you</h3>
            <p>Features: category, brand, price band and engineering traits (titanium, planar, X-Pac, R2R…), each with a weight and an uncertainty. A &ldquo;no&rdquo; moves only what the reason names. Saves are strong yeses, opens weak ones. Feed rank = taste<sup>0.6</sup> × genuineness<sup>0.4</sup>, boosted for deals ending within 72 hours; gear you own is pushed down.</p>
          </div></section>
        )}
      </main>
      <footer className="band"><div className="wrap">Personal tool. Prices from public store feeds and Slickdeals; not affiliated with any retailer.</div></footer>
      {toast && <div className="toast" role="status" onClick={() => setToast(null)}>{toast}</div>}
    </>
  );
}

function Brands({ items, model, onPick }: { items: Deal[]; model: Model; onPick: (b: string) => void }) {
  const rated = new Set(model.s.ratings.map((r) => items.find((d) => d.id === r.id)?.brand.toLowerCase()));
  const m = new Map<string, { name: string; n: number; best: number; cats: Record<string, number> }>();
  for (const d of items) {
    const b = d.brand.toLowerCase(); const r = m.get(b) ?? { name: d.brand, n: 0, best: 0, cats: {} };
    r.n++; r.best = Math.max(r.best, d.real); r.cats[d.cat] = (r.cats[d.cat] ?? 0) + 1; m.set(b, r);
  }
  const rows = [...m].filter(([, r]) => r.n >= 2).map(([b, r]) => ({ b, ...r, aff: model.W(`brand:${b}`), cat: Object.entries(r.cats).sort((a, c) => c[1] - a[1])[0][0] }))
    .sort((a, b) => b.aff - a.aff || b.best - a.best).slice(0, 80);
  return (
    <section className="band"><div className="wrap">
      <h2 style={{ fontSize: 34 }}>Brands</h2>
      <p className="muted">Ranked by what the model thinks of each brand. Unrated brands are marked new; the Explore slider mixes their strongest deals into your feed.</p>
      <div className="scroll"><table>
        <thead><tr><th>Brand</th><th>Category</th><th className="n">Deals</th><th className="n">Best genuine</th><th className="n">Affinity</th><th /></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.b}>
            <td>{r.name}{!rated.has(r.b) && model.W(`brand:${r.b}`) === 0 && <> <span className="pill">new</span></>}</td>
            <td>{CATS[r.cat] ?? r.cat}</td><td className="n num">{r.n}</td><td className="n num">{r.best}</td>
            <td className="n num">{r.aff >= 0 ? "+" : ""}{r.aff.toFixed(2)}</td>
            <td><button className="btn ghost small" onClick={() => onPick(r.name)}>Show deals</button></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div></section>
  );
}
