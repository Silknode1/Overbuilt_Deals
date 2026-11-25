import { sb } from "./supabase";

const b64 = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Must be called from a tap (iOS requires a user gesture, and the app must be on the Home Screen). */
export async function enablePush(): Promise<string> {
  if (!pushSupported()) return "This browser can't receive push. On iPhone: Share → Add to Home Screen, then open it from there.";
  const c = sb(); const { data: u } = (await c?.auth.getUser()) ?? { data: { user: null } };
  if (!c || !u.user) return "Sign in first so alerts go to your account only.";
  const { data: key } = await c.from("app_public").select("value").eq("name", "vapid_public").maybeSingle();
  if (!key?.value) return "Alerts aren't set up on the server yet. Try again after the next refresh.";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "Notifications are blocked for this site.";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key.value) });
  const j = sub.toJSON();
  const { error } = await c.from("push_subscriptions").upsert({ endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, user_id: u.user.id });
  return error ? "Couldn't save the subscription: " + error.message : "Alerts on. You'll get at most 3 a day, only for genuine lows that fit your taste.";
}
