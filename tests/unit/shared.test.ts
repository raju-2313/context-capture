import { describe, it, expect } from "vitest";
import { normaliseSearchText, stripDiacritics, extractDomain, sanitiseFilename, generateId } from "../../src/shared/types";
import { isRestrictedUrl, isSensitiveDomain, normaliseUrlForStorage } from "../../src/shared/constants";
import { createRestrictedPageError, createQuotaError, createDBError, isAppError } from "../../src/shared/errors";

describe("shared types", () => {
  it("normaliseSearchText handles nulls", () => {
    expect(normaliseSearchText([null, undefined, ""])).toBe("");
    expect(normaliseSearchText(["Hello", "World"])).toBe("hello world");
  });

  it("stripDiacritics", () => {
    expect(stripDiacritics("résumé")).toBe("resume");
  });

  it("extractDomain", () => {
    expect(extractDomain("https://sub.example.com/path")).toBe("sub.example.com");
    expect(extractDomain("chrome://settings")).toBe(null);
  });

  it("sanitiseFilename", () => {
    expect(sanitiseFilename("a<b>c")).toBe("a_b_c");
  });

  it("generateId", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});

describe("constants", () => {
  it("isRestrictedUrl", () => {
    expect(isRestrictedUrl("chrome://settings")).toBe(true);
    expect(isRestrictedUrl("https://example.com")).toBe(false);
    expect(isRestrictedUrl("view-source:http://x")).toBe(true);
  });

  it("isSensitiveDomain", () => {
    expect(isSensitiveDomain("banking.com", ["banking.com"])).toBe(true);
    expect(isSensitiveDomain("safe.com", ["banking.com"])).toBe(false);
    expect(isSensitiveDomain(null, ["banking.com"])).toBe(false);
  });

  it("normaliseUrlForStorage", () => {
    expect(normaliseUrlForStorage("https://x.com/a?q=1#frag", true, true)).toBe("https://x.com/a");
    expect(normaliseUrlForStorage("https://x.com/a?q=1#frag", false, false)).toBe("https://x.com/a?q=1#frag");
  });
});

describe("errors", () => {
  it("creates app errors", () => {
    const err = createRestrictedPageError("test detail");
    expect(err.code).toBe("RESTRICTED_PAGE");
    expect(isAppError(err)).toBe(true);

    const qErr = createQuotaError("full");
    expect(qErr.code).toBe("QUOTA_EXCEEDED");

    const dbErr = createDBError("fail");
    expect(dbErr.code).toBe("DB_ERROR");

    expect(isAppError(new Error("regular"))).toBe(false);
  });
});
