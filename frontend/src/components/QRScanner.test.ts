import { describe, expect, it } from "vitest";
import { extractCardId } from "./QRScanner";

describe("extractCardId", () => {
  it("accepts a raw UUID", () => {
    const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(extractCardId(id)).toBe(id);
  });

  it("extracts UUID from /verify/:id URL", () => {
    expect(
      extractCardId(
        "https://example.com/verify/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      ),
    ).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("extracts UUID from /members/:id URL", () => {
    expect(
      extractCardId(
        "https://example.com/members/a1b2c3d4-e5f6-7890-abcd-ef1234567890?x=1",
      ),
    ).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("returns null for unrelated text", () => {
    expect(extractCardId("not-a-card")).toBeNull();
  });
});
