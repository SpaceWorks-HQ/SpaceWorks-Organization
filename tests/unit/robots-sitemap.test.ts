import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("robots and sitemap", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("points crawlers at an absolute sitemap and keeps private areas out", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://members.test/");
    const result = robots();
    expect(result.sitemap).toBe("https://members.test/sitemap.xml");
    const rules = Array.isArray(result.rules) ? result.rules[0]! : result.rules;
    expect(rules.disallow).toEqual(expect.arrayContaining(["/dashboard/", "/super-admin", "/account", "/join/", "/verify/", "/start"]));
  });

  it("omits the sitemap line without a public address", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    expect(robots().sitemap).toBeUndefined();
  });

  it("lists the public legal pages", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://members.test");
    expect(sitemap().map((entry) => entry.url)).toEqual(expect.arrayContaining(["https://members.test/privacy", "https://members.test/terms"]));
  });
});
