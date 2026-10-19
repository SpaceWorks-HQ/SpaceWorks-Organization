import { describe, expect, it } from "vitest";
import {
  buildOrganizationAbbreviation,
  extractMembershipId,
  generateMembershipId,
} from "./membershipId";

describe("membershipId utilities", () => {
  it("builds abbreviations from org names", () => {
    expect(buildOrganizationAbbreviation("Space Works")).toBe("SW");
    expect(buildOrganizationAbbreviation("Space Works")).toMatch(/^[A-Z]+$/);
  });

  it("generates membership ids with date sequence", () => {
    const id = generateMembershipId("Space Works", 7, new Date("2026-03-15"));
    expect(id).toBe("SW-2603-00007");
  });

  it("extracts membership id from member source", () => {
    expect(
      extractMembershipId({ membership_id: " SW-2603-00001 " }),
    ).toBe("SW-2603-00001");
    expect(
      extractMembershipId({
        custom_fields: { "Membership ID": "ORG-2501-00002" },
      }),
    ).toBe("ORG-2501-00002");
  });
});
