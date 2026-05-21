import { MockSearchProvider } from "../mock/mock-providers.js";
import { GoogleGroundedSearchProvider } from "./google-grounded-search-provider.js";
import type { SearchProvider } from "./interfaces.js";

export type SearchProviderMode = "auto" | "mock" | "google";

export type SearchProviderFactoryOptions = {
  mode?: SearchProviderMode;
  googleApiKey?: string;
};

export type SearchProviderStatus = {
  defaultProvider: "mock" | "google";
  providers: Array<{
    id: "mock" | "google";
    name: string;
    configured: boolean;
    activeByDefault: boolean;
    notes: string;
  }>;
  deepResearch: {
    provider: "mock" | "gemini";
    configured: boolean;
    model?: string;
    notes: string;
  };
};

export function createSearchProvider(options: SearchProviderFactoryOptions = {}): {
  provider: SearchProvider;
  providerName: "mock" | "google";
} {
  const mode = options.mode ?? "auto";
  const googleApiKey = options.googleApiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (mode === "google") {
    if (!googleApiKey) throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is required for provider=google.");
    return { provider: new GoogleGroundedSearchProvider({ apiKey: googleApiKey }), providerName: "google" };
  }

  if (mode === "auto" && googleApiKey) {
    return { provider: new GoogleGroundedSearchProvider({ apiKey: googleApiKey }), providerName: "google" };
  }

  return { provider: new MockSearchProvider(), providerName: "mock" };
}

export function getSearchProviderStatus(env: NodeJS.ProcessEnv = process.env): SearchProviderStatus {
  const googleConfigured = Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
  const geminiConfigured = Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
  const defaultProvider = googleConfigured ? "google" : "mock";

  return {
    defaultProvider,
    providers: [
      {
        id: "mock",
        name: "Mock local fixtures",
        configured: true,
        activeByDefault: defaultProvider === "mock",
        notes: "Always available for tests, demos, and offline development."
      },
      {
        id: "google",
        name: "Gemini Grounding with Google Search",
        configured: googleConfigured,
        activeByDefault: defaultProvider === "google",
        notes: googleConfigured ? "Enabled through GEMINI_API_KEY or GOOGLE_API_KEY." : "Set GEMINI_API_KEY to enable Google Search grounding."
      }
    ],
    deepResearch: {
      provider: geminiConfigured ? "gemini" : "mock",
      configured: geminiConfigured,
      model: geminiConfigured ? (env.GEMINI_MODEL ?? "gemini-2.5-flash") : undefined,
      notes: geminiConfigured ? "Enabled through GEMINI_API_KEY or GOOGLE_API_KEY." : "Set GEMINI_API_KEY to enable Gemini deep research."
    }
  };
}

import { MockDeepResearchProvider } from "../mock/mock-deep-research-provider.js";
import { GeminiDeepResearchProvider } from "./gemini-deep-research-provider.js";
import type { DeepResearchProvider } from "./interfaces.js";

export function createDeepResearchProvider(options: SearchProviderFactoryOptions = {}): {
  provider: DeepResearchProvider;
  providerName: "mock" | "real";
} {
  const geminiKey = options.googleApiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    return { provider: new GeminiDeepResearchProvider(geminiKey), providerName: "real" };
  }
  return { provider: new MockDeepResearchProvider(), providerName: "mock" };
}

