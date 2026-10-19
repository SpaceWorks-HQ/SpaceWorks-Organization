import { describe, expect, it } from "vitest";
import axe from "axe-core";

describe("axe-core tooling", () => {
  it("exposes axe.run for a11y checks", () => {
    expect(typeof axe.run).toBe("function");
  });
});
