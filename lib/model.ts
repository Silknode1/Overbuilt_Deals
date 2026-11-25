// Taste model + ranking. Pure functions, no React.
// A deal is a bag of features (category, brand, price band, engineering traits). Each feature has a
// weight (mean) and an uncertainty (variance). Ratings move only the features that match the reason.

export type Deal = {
  id: string; title: string; brand: string; store: string; domain: string; url: string; cat: string;
  feats?: string[]; model?: string; cond?: "new" | "used"; price?: number; ref?: number; variant?: string;
  src: "shopify" | "slickdeals" | "marketplace" | "announcement" | "search"; note?: string; posted?: string;
  claimed?: number; hist?: { low: number; date?: string; n?: number }; elsewhere?: { price: number; store: string };
  real: number; verdict: string; conf: string; p_drop: number; ends?: string; buy: string; t0: number; img?: string; full?: boolean;
};
export type Prior = {
  bias: number; cat: Record<string, number>; feat: Record<string, number>; brand: Record<string, number>;
  band: Record<string, number>; owned: string[];
};
export type Snapshot = {
  generated: string; counts: { products_scanned: number; stores: number; slickdeals: number };
  events: { name: string; at: string }[]; prior: Prior; items: Deal[];
};
export type Reason = "item" | "price" | "style" | "brand" | "own" | "later";
export type State = {
  w: Record<string, number>; v: Record<string, number>;
  ratings: { id: string; yes: boolean; reason?: Reason; t: number }[];
  watch: Record<string, number>; dismiss: Record<string, Reason>; clicks: Record<string, number>;
  owned: string[]; calDone: string[]; explore: number;
};

export const CATS: Record<string, string> = {
  audio: "Hi-fi audio", edc: "EDC", bags: "Backpacks", luggage: "Luggage", tactical: "Tactical",
  gadgets: "Gadgets", health: "Health hardware", charging: "Charging", home: "Coffee & home", apparel: "Apparel",
  camping: "Camping & outdoors", floyd: "Pink Floyd & memorabilia", brick: "Bricks, resin & collectibles", parts: "Maker parts",
};
export const REASONS: [Reason, string][] = [
  ["item", "Don't want this kind of thing"], ["price", "Price too high"], ["style", "Not my style"],
  ["brand", "Not this brand"], ["own", "Already own something like it"], ["later", "Not now"],
];

export const freshState = (): State => ({ w: {}, v: {}, ratings: [], watch: {}, dismiss: {}, clicks: {}, owned: [], calDone: [], explore: 15 });

const band = (p?: number) =>
  p == null ? "100-500" : p < 40 ? "<40" : p < 100 ? "40-100" : p < 500 ? "100-500" : p < 1500 ? "500-1500" : "1500+";
const sig = (x: number) => 1 / (1 + Math.exp(-x));

export class Model {
  constructor(private prior: Prior, public s: State) {}

  keys(d: Deal): string[] {
    const k = [`cat:${d.cat}`, `brand:${d.brand.toLowerCase()}`, `band:${d.cat}:${band(d.price)}`];
    for (const f of d.feats ?? []) k.push(`feat:${f}`);
    const t = d.title.toLowerCase();
    if ([...this.prior.owned, ...this.s.owned].some((o) => o && t.includes(o))) k.push("feat:owned");
    return k;
  }
  private priorOf(k: string): number {
    const [g, a, b] = k.split(":");
    if (g === "band") return this.prior.band[b] ?? 0;
    return (this.prior as unknown as Record<string, Record<string, number>>)[g]?.[a] ?? 0;
  }
  W = (k: string) => (k in this.s.w ? this.s.w[k] : this.priorOf(k));
  V = (k: string) => (k in this.s.v ? this.s.v[k] : 0.6);

  taste = (d: Deal) => sig(this.prior.bias + this.keys(d).reduce((s, k) => s + this.W(k), 0));

  private update(d: Deal, y: 0 | 1, only?: string[], strength = 1) {
    const p = this.taste(d);
    for (const k of this.keys(d).filter((k) => !only || only.some((o) => k.startsWith(o)))) {
      const v = this.V(k);
      this.s.w[k] = this.W(k) + v * (y - p) * strength;
      this.s.v[k] = Math.max(0.08, v * 0.88); // more evidence → smaller steps
    }
  }

  rate(d: Deal, yes: boolean, reason?: Reason) {
    this.s.ratings.push({ id: d.id, yes, reason, t: Date.now() });
    if (yes) return this.update(d, 1);
    switch (reason) {
      case "price": return this.update(d, 0, ["band:"]);           // what you'll pay, not whether you like it
      case "brand": return this.update(d, 0, ["brand:"]);
      case "style": return this.update(d, 0, ["feat:", "brand:"], 0.7);
      case "item": return this.update(d, 0, ["cat:", "feat:"]);
      case "own": if (d.model) this.s.owned.push(d.model); return this.update(d, 0, ["feat:"], 0.4);
      case "later": return;                                          // no taste signal
      default: return this.update(d, 0);
    }
  }
  implicit(d: Deal, kind: "open" | "save" | "dismiss") {
    if (kind === "open") this.update(d, 1, undefined, 0.35);
    if (kind === "save") this.update(d, 1);
    if (kind === "dismiss") this.update(d, 0, undefined, 0.7);
  }

  urgency(d: Deal) {
    if (!d.ends) return 1;
    const h = (new Date(d.ends).getTime() - Date.now()) / 36e5;
    return h < 0 ? 0.7 : h < 72 ? 1.25 : 1;
  }
  score = (d: Deal) => Math.pow(this.taste(d), 0.6) * Math.pow((d.real || 50) / 100, 0.4) * this.urgency(d);

  why(d: Deal) {
    return this.keys(d).map((k) => [k, this.W(k)] as const).filter(([, w]) => w > 0.25)
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k]) => { const x = k.split(":").at(-1)!; return CATS[x] ?? x.replace(/^\w/, (c) => c.toUpperCase()); });
  }

  /** "For you" ranking with brand diversity and an exploration share for unrated brands. */
  rank(items: Deal[], explorePct: number): [Deal, boolean][] {
    const xs = [...items].sort((a, b) => this.score(b) - this.score(a));
    const byId = new Map(items.map((d) => [d.id, d]));
    const rated = new Set(this.s.ratings.map((r) => byId.get(r.id)?.brand.toLowerCase()));
    const explore = xs.filter((d) => !rated.has(d.brand.toLowerCase()) && !(d.brand.toLowerCase() in this.prior.brand) && d.real >= 60)
      .sort((a, b) => b.real - a.real);
    const every = explorePct ? Math.max(2, Math.round(100 / explorePct)) : 0;
    const used = new Set<string>(); const out: [Deal, boolean][] = []; let e = 0;
    for (let n = 0; out.length < xs.length; n++) {
      if (every && (n + 1) % every === 0) {
        while (explore[e] && used.has(explore[e].id)) e++;
        if (explore[e]) { used.add(explore[e].id); out.push([explore[e++], true]); continue; }
      }
      const recent = out.slice(-10).map(([d]) => d.brand);
      const ok = (d: Deal) => recent.filter((b) => b === d.brand).length < 2;
      const d = xs.find((x) => !used.has(x.id) && ok(x)) ?? xs.find((x) => !used.has(x.id));
      if (!d) break;
      used.add(d.id); out.push([d, false]);
    }
    return out;
  }

  /** Calibration deck: stratified by category, strongest picks plus one mid-ranked contrast per category. */
  deck(items: Deal[]): Deal[] {
    const per: Record<string, number> = { audio: 7, edc: 5, bags: 5, tactical: 4, gadgets: 4, health: 4, luggage: 3, charging: 2, apparel: 1, home: 1, camping: 4, floyd: 2, brick: 3, parts: 3 };
    const out: Deal[] = [];
    for (const [c, n] of Object.entries(per)) {
      const pool = items.filter((d) => d.cat === c && d.price != null && !this.s.calDone.includes(d.id))
        .sort((a, b) => Number(!!b.img) - Number(!!a.img) || this.score(b) - this.score(a));
      const brands = new Set<string>(); const pick: Deal[] = [];
      for (const d of pool) { if (pick.length >= n) break; const b = d.brand.toLowerCase(); if (brands.has(b) && pool.length > n * 2) continue; brands.add(b); pick.push(d); }
      if (pick.length > 2 && pool.length > 20) pick[pick.length - 1] = pool[Math.floor(pool.length / 3)];
      out.push(...pick);
    }
    return out.sort(() => Math.random() - 0.5);
  }

  profile(): [string, number][] {
    const ent = new Map<string, number>();
    for (const k of [...Object.keys(this.prior.cat).map((c) => `cat:${c}`), ...Object.keys(this.s.w)])
      if (!k.startsWith("band:")) ent.set(k, this.W(k));
    return [...ent].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 16);
  }
}

export const money = (p?: number | null) =>
  p == null ? "—" : "$" + (p >= 1000 ? Math.round(p).toLocaleString() : p.toFixed(p % 1 ? 2 : 0));
export const countdown = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "ended";
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return d ? `${d}d ${h}h` : `${h}h ${m}m`;
};
export const verdictClass = (r: number) => (r >= 75 ? "v-hi" : r >= 55 ? "v-mid" : "v-lo");
export const safeUrl = (u?: string) => (u && /^https:\/\//.test(u) ? u : "#");
