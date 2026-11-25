// Live price check: reads one product's current Shopify JSON. Only tracked store domains are allowed.
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";

const ALLOWED = new Set(
  readFileSync(path.join(process.cwd(), "pipeline/domains.txt"), "utf8")
    .split("\n").map((l) => l.split("|")).filter((p) => p[1] && p[1] !== "x").map((p) => p[0]),
);

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  let u: URL;
  try { u = new URL(raw); } catch { return NextResponse.json({ error: "Bad URL." }, { status: 400 }); }
  if (u.protocol !== "https:" || !ALLOWED.has(u.hostname) || !/^\/products\/[\w-]+$/.test(u.pathname))
    return NextResponse.json({ error: "Not a tracked store product." }, { status: 400 });
  const r = await fetch(`https://${u.hostname}${u.pathname}.js`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!r.ok) return NextResponse.json({ error: `Store answered ${r.status}. Open the store to confirm.` }, { status: 502 });
  const j = await r.json();
  const vs = (j.variants ?? []).filter((v: { available: boolean; price: number }) => v.available && v.price);
  if (!vs.length) return NextResponse.json({ error: "No in-stock variant right now." }, { status: 404 });
  const v = vs.reduce((a: { price: number }, b: { price: number }) => (a.price < b.price ? a : b));
  return NextResponse.json({ price: v.price / 100, ref: v.compare_at_price ? v.compare_at_price / 100 : null, checked: new Date().toISOString() });
}
