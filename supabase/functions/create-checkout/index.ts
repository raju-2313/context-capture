import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const razorpayApi = "https://api.razorpay.com/v1";

function basicAuth(keyId: string, keySecret: string): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  const planId = Deno.env.get("RAZORPAY_PLAN_ID");
  if (!keyId || !keySecret || !planId) return json({ error: "Paid plans are not configured" }, 503);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Authentication required" }, 401);

  const requestBody = {
    plan_id: planId,
    total_count: Number(Deno.env.get("RAZORPAY_TOTAL_COUNT") || "120"),
    quantity: 1,
    customer_notify: 1,
    notes: {
      user_id: user.id,
      plan_id: "pro",
    },
  };
  if (!Number.isInteger(requestBody.total_count) || requestBody.total_count <= 0) {
    return json({ error: "Paid plan billing configuration is invalid" }, 503);
  }

  const response = await fetch(`${razorpayApi}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(keyId, keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof payload.id !== "string") {
    console.error("Razorpay subscription creation failed", response.status, payload.error);
    return json({ error: "Could not create Razorpay subscription" }, 502);
  }

  return json({
    provider: "razorpay",
    subscriptionId: payload.id,
    checkoutUrl: typeof payload.short_url === "string" ? payload.short_url : undefined,
    keyId,
    planId,
    currency: Deno.env.get("RAZORPAY_CURRENCY") || "USD",
    amount: Deno.env.get("RAZORPAY_AMOUNT") || "",
    disclosure: "Currency display, recurring-card eligibility, and settlement depend on Razorpay account activation and supported currencies.",
  });
});
