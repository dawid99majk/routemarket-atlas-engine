import { describe, expect, it, vi } from "vitest";
import { BraveSearchProvider } from "../packages/atlas-research/src/providers/brave-search-provider.js";
import { createSearchProvider, getSearchProviderStatus } from "../packages/atlas-research/src/providers/provider-factory.js";

describe("search providers", () => {
  it("maps Brave Search results into source candidates", async () => {
    let requestedUrl: URL | undefined;
    let requestedHeaders: HeadersInit | undefined;
    const provider = new BraveSearchProvider({
      apiKey: "brave_test_key",
      fetchImpl: vi.fn(async (url, init) => {
        requestedUrl = new URL(String(url));
        requestedHeaders = init?.headers;
        return new Response(
          JSON.stringify({
            web: {
              results: [
                {
                  title: "Official Albania Tourism",
                  url: "https://albania.tourism.example/routes",
                  description: "Official route guidance."
                },
                {
                  title: "Rider GPX",
                  url: "https://example.com/albania-route.gpx",
                  description: "Downloadable GPX."
                },
                {
                  title: "Video report",
                  url: "https://www.youtube.com/watch?v=abc",
                  description: "Road conditions."
                }
              ]
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    });

    const results = await provider.search({
      query: "Albania motorcycle route",
      category: "motorcycle",
      region: "Albania",
      language: "en",
      limit: 3
    });

    expect(requestedUrl?.searchParams.get("q")).toBe("Albania motorcycle route");
    expect(requestedUrl?.searchParams.get("count")).toBe("3");
    expect(requestedUrl?.searchParams.get("search_lang")).toBe("en");
    expect(requestedHeaders).toMatchObject({ "X-Subscription-Token": "brave_test_key" });
    expect(results.map((result) => result.sourceType)).toEqual(["official", "gpx", "youtube"]);
    expect(results[0]).toMatchObject({
      title: "Official Albania Tourism",
      language: "en",
      licenseStatus: "unknown",
      trustScore: 86
    });
  });

  it("uses mock provider in auto mode without a Brave key", () => {
    const previous = process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.BRAVE_SEARCH_API_KEY;

    try {
      const created = createSearchProvider({ mode: "auto" });
      expect(created.providerName).toBe("mock");
    } finally {
      process.env.BRAVE_SEARCH_API_KEY = previous;
    }
  });

  it("requires a Brave key when Brave mode is forced", () => {
    expect(() => createSearchProvider({ mode: "brave", braveApiKey: "" })).toThrow("BRAVE_SEARCH_API_KEY");
  });

  it("reports provider status without exposing secrets", () => {
    const status = getSearchProviderStatus({ BRAVE_SEARCH_API_KEY: "secret_value" });

    expect(status.defaultProvider).toBe("brave");
    expect(status.providers.find((provider) => provider.id === "brave")).toMatchObject({
      configured: true,
      activeByDefault: true
    });
    expect(JSON.stringify(status)).not.toContain("secret_value");
  });
});
