import { MockSearchProvider } from "../mock/mock-providers.js";
import { BraveSearchProvider } from "./brave-search-provider.js";
import type { SearchProvider } from "./interfaces.js";

export type SearchProviderMode = "auto" | "mock" | "brave";

export type SearchProviderFactoryOptions = {
  mode?: SearchProviderMode;
  braveApiKey?: string;
};

export type SearchProviderStatus = {
  defaultProvider: "mock" | "brave";
  providers: Array<{
    id: "mock" | "brave";
    name: string;
    configured: boolean;
    activeByDefault: boolean;
    notes: string;
  }>;
};

export function createSearchProvider(options: SearchProviderFactoryOptions = {}): {
  provider: SearchProvider;
  providerName: "mock" | "brave";
} {
  const mode = options.mode ?? "auto";
  const braveApiKey = options.braveApiKey ?? process.env.BRAVE_SEARCH_API_KEY;

  if (mode === "brave") {
    if (!braveApiKey) throw new Error("BRAVE_SEARCH_API_KEY is required for provider=brave.");
    return { provider: new BraveSearchProvider({ apiKey: braveApiKey }), providerName: "brave" };
  }

  if (mode === "auto" && braveApiKey) {
    return { provider: new BraveSearchProvider({ apiKey: braveApiKey }), providerName: "brave" };
  }

  return { provider: new MockSearchProvider(), providerName: "mock" };
}

export function getSearchProviderStatus(env: NodeJS.ProcessEnv = process.env): SearchProviderStatus {
  const braveConfigured = Boolean(env.BRAVE_SEARCH_API_KEY);
  const defaultProvider = braveConfigured ? "brave" : "mock";

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
        id: "brave",
        name: "Brave Search API",
        configured: braveConfigured,
        activeByDefault: defaultProvider === "brave",
        notes: braveConfigured ? "Enabled through BRAVE_SEARCH_API_KEY." : "Set BRAVE_SEARCH_API_KEY to enable real web search."
      }
    ]
  };
}

import { MockDeepResearchProvider } from "../mock/mock-deep-research-provider.js";
import type { DeepResearchProvider } from "./interfaces.js";

export function createDeepResearchProvider(options: SearchProviderFactoryOptions = {}): {
  provider: DeepResearchProvider;
  providerName: "mock" | "real";
} {
  return { provider: new MockDeepResearchProvider(), providerName: "mock" };
}
