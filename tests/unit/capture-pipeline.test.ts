import { describe, it, expect, vi, beforeEach } from "vitest";

describe("capture pipeline (mocked)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("generates unique capture IDs", () => {
    const cryptoSpy = vi.spyOn(crypto, "randomUUID");
    cryptoSpy.mockReturnValue("id-1");
    const id1 = crypto.randomUUID();
    cryptoSpy.mockReturnValue("id-2");
    const id2 = crypto.randomUUID();
    expect(id1).not.toBe(id2);
  });
});
