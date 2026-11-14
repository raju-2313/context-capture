import { describe, expect, it } from "vitest";
import {
  parseRazorpayCheckout,
  resolveRazorpayBillingState,
  verifyRazorpaySignature,
} from "../../src/core/billing/razorpay";

describe("Razorpay billing", () => {
  it("verifies the raw webhook payload signature and rejects tampering", async () => {
    const payload = JSON.stringify({ event: "subscription.activated" });
    const secret = "webhook-secret";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
    const signature = Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0")).join("");

    await expect(verifyRazorpaySignature(payload, signature, secret)).resolves.toBe(true);
    await expect(verifyRazorpaySignature(`${payload}x`, signature, secret)).resolves.toBe(false);
  });

  it("accepts a server-controlled hosted checkout response", () => {
    expect(parseRazorpayCheckout({
      provider: "razorpay",
      subscriptionId: "sub_123",
      checkoutUrl: "https://rzp.io/i/example",
      keyId: "rzp_test_public",
      planId: "plan_123",
      currency: "USD",
      amount: "9",
      disclosure: "Account-dependent",
    }).subscriptionId).toBe("sub_123");
    expect(() => parseRazorpayCheckout({ provider: "stripe" })).toThrow();
  });

  it.each([
    ["subscription.activated", true, "active"],
    ["subscription.charged", true, "active"],
    ["subscription.cancelled", false, "cancelled"],
    ["subscription.paused", false, "paused"],
    ["subscription.expired", false, "expired"],
    ["payment.failed", false, "past_due"],
  ])("maps %s to the correct entitlement state", (event, active, status) => {
    expect(resolveRazorpayBillingState(event)).toEqual({ active, status });
  });
});
