import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const timestamp = header.match(/t=(\d+)/)?.[1];
  const signature = header.match(/v1=([a-f0-9]+)/)?.[1];
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  const expected = Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const payload = await request.text();
  const signature = request.headers.get("Stripe-Signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !secret || !(await verifyStripeSignature(payload, signature, secret))) return json({ error: "Invalid signature" }, 400);
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
  const object = event.data.object;
  const userId = String(object.client_reference_id || object.metadata?.user_id || "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (event.type === "checkout.session.completed" && userId) {
    await admin.from("profiles").upsert({ user_id: userId, plan_id: "pro", stripe_customer_id: object.customer });
    await admin.from("subscriptions").upsert({ user_id: userId, stripe_subscription_id: object.subscription, status: "active" });
  }
  if ((event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") && object.id) {
    const { data: subscription } = await admin.from("subscriptions").select("user_id").eq("stripe_subscription_id", object.id).maybeSingle();
    if (subscription?.user_id) {
      const active = event.type !== "customer.subscription.deleted" && ["active", "trialing"].includes(String(object.status));
      await admin.from("profiles").update({ plan_id: active ? "pro" : "free" }).eq("user_id", subscription.user_id);
      await admin.from("subscriptions").update({ status: String(object.status) }).eq("stripe_subscription_id", object.id);
    }
  }
  return new Response("ok", { headers: { ...corsHeaders, "Content-Type": "text/plain" } });
});
