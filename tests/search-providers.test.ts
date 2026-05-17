import { describe, expect, it } from "vitest";
import { GoogleGroundedSearchProvider } from "../packages/atlas-research/src/providers/google-grounded-search-provider.js";
import { createDeepResearchProvider, createSearchProvider, getSearchProviderStatus } from "../packages/atlas-research/src/providers/provider-factory.js";

describe("search providers", () => {
  it("maps Google grounded search results into source candidates", async () => {
    let requestedUrl: URL | undefined;
    let requestedHeaders: HeadersInit | undefined;
    const provider = new GoogleGroundedSearchProvider({
      apiKey: "google_test_key",
      model: "gemini-test-model",
      fetchImpl: async (url, init) => {
        requestedUrl = new URL(String(url));
        requestedHeaders = init?.headers;
        return new Response(
          JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    sources: [
                      {
                        title: "Official Albania Tourism",
                        url: "https://albania.tourism.example/routes",
                        summary: "Official route guidance.",
                        sourceType: "official",
                        relevanceScore: 90,
                        trustScore: 86
                      },
                      {
                        title: "Video report",
                        url: "https://www.youtube.com/watch?v=abc",
                        summary: "Road conditions.",
                        sourceType: "youtube",
                        relevanceScore: 70,
                        trustScore: 52
                      }
                    ]
                  })
                }]
              },
              groundingMetadata: {
                groundingChunks: [
                  { web: { uri: "https://example.com/albania-route.gpx", title: "Rider GPX" } }
                ]
              }
            }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    });

    const results = await provider.search({
      query: "Albania motorcycle route",
      category: "motorcycle",
      region: "Albania",
      language: "en",
      limit: 3
    });

    expect(requestedUrl?.hostname).toBe("generativelanguage.googleapis.com");
    expect(requestedUrl?.pathname).toContain("gemini-test-model:generateContent");
    expect(requestedHeaders).toMatchObject({ "x-goog-api-key": "google_test_key" });
    expect(results.map((result) => result.sourceType)).toEqual(["official", "youtube", "gpx"]);
    expect(results[0]).toMatchObject({
      title: "Official Albania Tourism",
      language: "en",
      licenseStatus: "unknown",
      trustScore: 86
    });
  });

  it("uses mock provider in auto mode without a Google key", () => {
    const previousGemini = process.env.GEMINI_API_KEY;
    const previousGoogle = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    try {
      const created = createSearchProvider({ mode: "auto" });
      expect(created.providerName).toBe("mock");
    } finally {
      if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousGemini;
      if (previousGoogle === undefined) delete process.env.GOOGLE_API_KEY;
      else process.env.GOOGLE_API_KEY = previousGoogle;
    }
  });

  it("uses Google grounded search in auto mode with a Google key", () => {
    const previousGemini = process.env.GEMINI_API_KEY;
    const previousGoogle = process.env.GOOGLE_API_KEY;
    process.env.GEMINI_API_KEY = "gemini_test_key";
    delete process.env.GOOGLE_API_KEY;

    try {
      const created = createSearchProvider({ mode: "auto" });
      expect(created.providerName).toBe("google");
      expect(created.provider.constructor.name).toBe("GoogleGroundedSearchProvider");
    } finally {
      if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousGemini;
      if (previousGoogle === undefined) delete process.env.GOOGLE_API_KEY;
      else process.env.GOOGLE_API_KEY = previousGoogle;
    }
  });

  it("requires a Google key when Google mode is forced", () => {
    expect(() => createSearchProvider({ mode: "google", googleApiKey: "" })).toThrow("GEMINI_API_KEY");
  });

  it("reports provider status without exposing secrets", () => {
    const status = getSearchProviderStatus({ GEMINI_API_KEY: "secret_value" });

    expect(status.defaultProvider).toBe("google");
    expect(status.providers.find((provider) => provider.id === "google")).toMatchObject({
      configured: true,
      activeByDefault: true
    });
    expect(JSON.stringify(status)).not.toContain("secret_value");
  });

  it("uses Gemini for deep research when configured", () => {
    const previousGemini = process.env.GEMINI_API_KEY;
    const previousGoogle = process.env.GOOGLE_API_KEY;
    process.env.GEMINI_API_KEY = "gemini_test_key";
    delete process.env.GOOGLE_API_KEY;

    try {
      const created = createDeepResearchProvider();
      expect(created.providerName).toBe("real");
      expect(created.provider.constructor.name).toBe("GeminiDeepResearchProvider");
    } finally {
      if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousGemini;
      if (previousGoogle === undefined) delete process.env.GOOGLE_API_KEY;
      else process.env.GOOGLE_API_KEY = previousGoogle;
    }
  });

  it("reports Gemini deep research status without exposing secrets", () => {
    const status = getSearchProviderStatus({ GEMINI_API_KEY: "gemini_secret", GEMINI_MODEL: "gemini-test-model" });

    expect(status.deepResearch).toMatchObject({
      provider: "gemini",
      configured: true,
      model: "gemini-test-model"
    });
    expect(JSON.stringify(status)).not.toContain("gemini_secret");
  });
});

import { GeminiDeepResearchProvider } from "../packages/atlas-research/src/providers/gemini-deep-research-provider.js";

describe("GeminiDeepResearchProvider", () => {
  it("extracts POIs and claims from scraped web content", async () => {
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn(async (url) => {
        if (String(url).includes("example.com")) {
          return new Response("<html><body>Stelvio Pass is a great pass. Closed in winter.</body></html>", { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      }) as any;

      let requestedUrl: string | undefined;
      const provider = new GeminiDeepResearchProvider("test_gemini_key", {
        model: "gemini-test-model",
        fetchImpl: async (url, init) => {
          requestedUrl = String(url);
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          pois: [{ name: "Stelvio Pass", type: "viewpoint", description: "Great pass", lat: 46.529, lng: 10.453 }],
                          claims: [{ claim: "Pass is closed in winter", type: "safety", confidence: 0.95 }]
                        })
                      }
                    ]
                  }
                }
              ]
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      });

      const res = await provider.scrapeAndExtract("https://example.com/source", "Stelvio Pass");

      expect(requestedUrl).toContain("gemini-test-model:generateContent");
      expect(res.pois).toHaveLength(1);
      expect(res.pois[0]).toMatchObject({ name: "Stelvio Pass", type: "viewpoint", lat: 46.529, lng: 10.453, isVerifiedByDeepResearch: true });
      expect(res.claims).toHaveLength(1);
      expect(res.claims[0]).toMatchObject({ claim: "Pass is closed in winter", type: "safety", confidence: 0.95 });
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

