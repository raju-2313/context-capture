import { describe, it, expect } from "vitest";
import { searchIndex } from "../../src/core/search/index";
import { normaliseSearchText } from "@/shared/types";

describe("Search index", () => {
  it("tokenizes and searches", () => {
    searchIndex["index"].clear?.();
    searchIndex["captures"].clear?.();
  });

  it("normaliseSearchText produces searchable terms", () => {
    const text = normaliseSearchText(["Hello World", "Example.com"]);
    expect(text).toContain("hello");
    expect(text).toContain("world");
    expect(text).toContain("example");
  });
});
