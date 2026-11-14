import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

async function hmacSha256(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyRazorpaySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const expected = hex(await hmacSha256(payload, secret));
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return difference === 0;
}

type WebhookPayload = {
  event?: string;
  payload?: {
    subscription?: { entity?: Record<string, unknown> };
    payment?: { entity?: Record<string, unknown> };
  };
};

const activeEvents = new Set(["subscription.activated", "subscription.charged", "subscription.resumed"]);
const inactiveEvents = new Set(["subscription.cancelled", "subscription.paused", "subscription.completed", "subscription.expired"]);

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const rawBody = await request.text();
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const signature = request.headers.get("x-razorpay-signature");
  if (!secret || !signature || !(await verifyRazorpaySignature(rawBody, signature, secret))) {
    return json({ error: "Invalid signature" }, 400);
  }

  let event: WebhookPayload;
  try {
    event = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const subscriptionEntity = event.payload?.subscription?.entity;
  const paymentEntity = event.payload?.payment?.entity;
  const knownEvent = activeEvents.has(event.event || "") || inactiveEvents.has(event.event || "") || event.event === "payment.failed";
  if (!knownEvent) return new Response("ok", { headers: { ...corsHeaders, "Content-Type": "text/plain" } });
  const subscriptionId = String(subscriptionEntity?.id || paymentEntity?.subscription_id || "");
  if (!subscriptionId) return new Response("ok", { headers: { ...corsHeaders, "Content-Type": "text/plain" } });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: existing } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("razorpay_subscription_id", subscriptionId)
    .maybeSingle();
  const notes = (subscriptionEntity?.notes || {}) as Record<string, unknown>;
  const userId = existing?.user_id || String(notes.user_id || "");
  if (!userId) return new Response("ok", { headers: { ...corsHeaders, "Content-Type": "text/plain" } });

  const isPaymentFailure = event.event === "payment.failed";
  const status = isPaymentFailure
    ? "past_due"
    : String(subscriptionEntity?.status || (activeEvents.has(event.event || "") ? "active" : "inactive"));
  const active = activeEvents.has(event.event || "");
  const currentEnd = Number(subscriptionEntity?.current_end || 0);

  await admin.from("subscriptions").upsert({
    user_id: userId,
    razorpay_subscription_id: subscriptionId,
    razorpay_customer_id: typeof subscriptionEntity?.customer_id === "string" ? subscriptionEntity.customer_id : null,
    status,
    current_period_end: currentEnd > 0 ? new Date(currentEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (active) {
    await admin.from("profiles").upsert({ user_id: userId, plan_id: "pro", updated_at: new Date().toISOString() });
  } else if (inactiveEvents.has(event.event || "") || isPaymentFailure) {
    await admin.from("profiles").update({ plan_id: "free", updated_at: new Date().toISOString() }).eq("user_id", userId);
  }

  return new Response("ok", { headers: { ...corsHeaders, "Content-Type": "text/plain" } });
});
