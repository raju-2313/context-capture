import { describe, it, expect } from "vitest";
import { exportEngine } from "../../src/core/export/index";

describe("Export engine", () => {
  it("exportEngine exists", () => {
    expect(exportEngine).toBeDefined();
    expect(typeof exportEngine.exportMarkdownCaptures).toBe("function");
    expect(typeof exportEngine.exportMarkdownContext).toBe("function");
    expect(typeof exportEngine.exportBackup).toBe("function");
  });
});
