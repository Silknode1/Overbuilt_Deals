"use client";
import { useState } from "react";
import { CATS, REASONS, countdown, money, safeUrl, verdictClass, type Deal, type Model, type Reason } from "@/lib/model";

const GLYPH: Record<string, string> = {
  audio: "M6 14a6 6 0 0 1 12 0v4h-3v-5h3M6 13h3v5H6z", edc: "M4 17l9-9 3 1 4-4M13 8l3 3",
  bags: "M6 10a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v10H6zM9 7V5h6v2M9 13h6", luggage: "M7 6h10v13H7zM10 6V4h4v2",
  tactical: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z", gadgets: "M5 4h14v16H5zM9 17h6",
  health: "M3 12h4l2-4 3 8 2-4h7", charging: "M13 3L6 13h5l-1 8 7-10h-5z",
  home: "M6 9h10v6a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4zM16 11h2a2 2 0 0 1 0 4h-2", apparel: "M8 4l4 3 4-3 4 4-3 3v9H7v-9L4 8z",
};

export function Gauge({ d }: { d: Deal }) {
  const p = d.price; if (p == null) return null;
  const lo = d.hist?.low, ref = d.ref;
  if (!lo && !ref) return null;
  const pts = [p, lo, ref, d.elsewhere?.price].filter((x): x is number => !!x);
  const a = Math.min(...pts) * 0.94, b = Math.max(...pts) * 1.04;
  const x = (v: number) => `${(((v - a) / (b - a)) * 100).toFixed(1)}%`;
  return (
    <div className="gauge" role="img" aria-label={`Price ${money(p)}${lo ? `, lowest seen ${money(lo)}` : ""}${ref ? `, claimed reference ${money(ref)}` : ""}`}>
      <div className="rail" />
      {lo && <><span className="m" style={{ left: x(lo) }} /><span className="lab" style={{ left: x(lo) }}>low {money(lo)}</span></>}
      {ref && <><span className="m" style={{ left: x(ref), opacity: 0.5 }} /><span className="lab" style={{ left: `min(${x(ref)}, 90%)` }}>was {money(ref)}</span></>}
      <span className="m now" style={{ left: x(p) }} />
    </div>
  );
}

type Props = {
  d: Deal; m: Model; explore?: boolean; cal?: boolean; saved?: boolean;
  onOpen?: () => void; onSave?: () => void; onYes?: () => void; onNo: (r: Reason) => void;
};

export default function DealCard({ d, m, explore, cal, saved, onOpen, onSave, onYes, onNo }: Props) {
  const [reasons, setReasons] = useState(false);
  const [live, setLive] = useState<string | null>(null);
  const why = m.why(d);
  const buyCls = d.buy.startsWith("Buy") ? "buy" : d.buy === "Wait" ? "wait" : "";

  async function checkLive() {
    setLive("Checking the store…");
    try {
      const r = await fetch(`/api/live?url=${encodeURIComponent(d.url)}`);
      const j = await r.json();
      if (!r.ok) return setLive(j.error ?? "Live check failed.");
      const diff = d.price ? j.price - d.price : 0;
      setLive(`Live: ${money(j.price)}${j.ref ? ` (was ${money(j.ref)})` : ""} · ${Math.abs(diff) < 0.5 ? "unchanged since snapshot" : `${diff < 0 ? "dropped" : "up"} ${money(Math.abs(diff))}`}`);
    } catch { setLive("Live check failed. Open the store to confirm."); }
  }

  return (
    <article className={`card${explore ? " explore" : ""}`}>
      <div className="thumb">
        {d.img ? <img src={d.img} alt="" loading="lazy" /> :
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={GLYPH[d.cat] ?? GLYPH.gadgets} fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>}
      </div>
      <div className="k">{d.brand} · {d.store}{explore && <> · <span style={{ color: "var(--accink)" }}>new to you</span></>}</div>
      <div className="title">{d.title}{d.variant && <span className="muted small"> ({d.variant})</span>}</div>
      <div className="pr">
        <span className="price">{d.price == null ? "Sale" : money(d.price)}</span>
        {d.ref && <span className="ref">{money(d.ref)}</span>}
        {d.claimed && <span className="off">−{Math.round(d.claimed * 100)}%</span>}
      </div>
      <Gauge d={d} />
      <div className={`verdict ${verdictClass(d.real)}`}>{d.verdict}</div>
      <div className="row">
        <span className={`pill ${buyCls}`}>{d.buy}</span>
        <span className="pill" title="Chance of a lower price before Jan 31">{Math.round(d.p_drop * 100)}% lower by Jan 31</span>
        {d.ends && <span className="pill cd">ends {countdown(d.ends)}</span>}
        <span className="pill num" title="Predicted taste">fit {Math.round(m.taste(d) * 100)}</span>
      </div>
      {d.note && <div className="small muted">{d.note}</div>}
      {why.length > 0 && <div className="why">Why: {why.join(" · ")}</div>}
      {cal ? (
        <div className="row calact">
          <button className="btn pri" onClick={onYes}>Yes, I&apos;d want it</button>
          <button className="btn" onClick={() => setReasons((r) => !r)}>No</button>
          <a className="btn ghost" href={safeUrl(d.url)} target="_blank" rel="noopener">View ↗</a>
        </div>
      ) : (
        <div className="row">
          <a className="btn pri" href={safeUrl(d.url)} target="_blank" rel="noopener" onClick={onOpen}>Open</a>
          <button className="btn" onClick={onSave}>{saved ? "Saved" : "Want"}</button>
          <button className="btn" onClick={() => setReasons((r) => !r)}>Not for me</button>
          {d.src === "shopify" && <button className="btn ghost" onClick={checkLive}>Check live price</button>}
        </div>
      )}
      <div className={`reasons${reasons ? " on" : ""}`}>
        {REASONS.map(([k, l]) => <button key={k} className="chip" onClick={() => { setReasons(false); onNo(k); }}>{l}</button>)}
      </div>
      {live && <div className="small muted">{live}</div>}
      <span hidden>{CATS[d.cat]}</span>
    </article>
  );
}
