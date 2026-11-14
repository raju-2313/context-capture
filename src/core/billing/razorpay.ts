import { settingsStore } from "../../data/settings";

export interface RazorpayCheckout {
  provider: "razorpay";
  subscriptionId: string;
  checkoutUrl?: string;
  keyId: string;
  planId: string;
  currency: string;
  amount: string;
  disclosure: string;
}

export async function verifyRazorpaySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  const expected = Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return difference === 0;
}

export function resolveRazorpayBillingState(event: string, subscriptionStatus?: string): { active: boolean; status: string } {
  if (event === "payment.failed") return { active: false, status: "past_due" };
  if (event === "subscription.activated" || event === "subscription.charged" || event === "subscription.resumed") {
    return { active: true, status: subscriptionStatus || "active" };
  }
  if (event === "subscription.cancelled" || event === "subscription.paused" ||
      event === "subscription.completed" || event === "subscription.expired") {
    return { active: false, status: subscriptionStatus || event.replace("subscription.", "") };
  }
  return { active: false, status: subscriptionStatus || "inactive" };
}

export function parseRazorpayCheckout(payload: unknown): RazorpayCheckout {
  if (!payload || typeof payload !== "object") throw new Error("Invalid Razorpay checkout response.");
  const value = payload as Record<string, unknown>;
  if (value["provider"] !== "razorpay" || typeof value["subscriptionId"] !== "string" ||
      typeof value["keyId"] !== "string" || typeof value["planId"] !== "string") {
    throw new Error("Razorpay checkout is not configured correctly.");
  }
  return {
    provider: "razorpay",
    subscriptionId: value["subscriptionId"],
    checkoutUrl: typeof value["checkoutUrl"] === "string" ? value["checkoutUrl"] : undefined,
    keyId: value["keyId"],
    planId: value["planId"],
    currency: typeof value["currency"] === "string" ? value["currency"] : "USD",
    amount: typeof value["amount"] === "string" ? value["amount"] : "",
    disclosure: typeof value["disclosure"] === "string" ? value["disclosure"] : "",
  };
}

export async function createRazorpaySubscription(): Promise<RazorpayCheckout> {
  const gatewayUrl = (await settingsStore.get("transcription_gateway_url"))?.trim();
  const sessionRaw = await settingsStore.get("supabase_auth_session");
  if (!gatewayUrl || !sessionRaw) throw new Error("Sign in to the managed gateway before upgrading.");
  let session: { access_token?: string };
  try {
    session = JSON.parse(sessionRaw) as { access_token?: string };
  } catch {
    throw new Error("Your managed gateway session is invalid. Try again.");
  }
  if (!session.access_token) throw new Error("Sign in to the managed gateway before upgrading.");

  const response = await fetch(`${gatewayUrl.replace(/\/$/, "")}/create-checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Could not start Razorpay checkout.");
  return parseRazorpayCheckout(payload);
}
