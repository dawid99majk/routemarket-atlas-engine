import type { SearchInput, SearchProvider, SourceCandidate } from "./interfaces.js";

type BraveSearchResult = {
  title?: string;
  url?: string;
  description?: string;
};

type BraveSearchResponse = {
  web?: {
    results?: BraveSearchResult[];
  };
};

export type BraveSearchProviderOptions = {
  apiKey: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

export class BraveSearchProvider implements SearchProvider {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: BraveSearchProviderOptions) {
    this.endpoint = options.endpoint ?? "https://api.search.brave.com/res/v1/web/search";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async search(input: SearchInput): Promise<SourceCandidate[]> {
    const url = new URL(this.endpoint);
    url.searchParams.set("q", input.query);
    url.searchParams.set("count", String(Math.max(1, Math.min(input.limit ?? 10, 20))));
    url.searchParams.set("search_lang", input.language);

    const response = await this.fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": this.options.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Brave Search failed with ${response.status}`);
    }

    const payload = (await response.json()) as BraveSearchResponse;
    return (payload.web?.results ?? [])
      .filter((result) => result.url && result.title)
      .map((result) => ({
        url: result.url as string,
        title: result.title as string,
        sourceType: classifySource(result.url as string),
        language: input.language,
        relevanceScore: 72,
        trustScore: trustScore(result.url as string),
        licenseStatus: "unknown",
        contentSummary: result.description ?? ""
      }));
  }
}

function classifySource(url: string): SourceCandidate["sourceType"] {
  const lowered = url.toLowerCase();
  if (lowered.includes("youtube.com") || lowered.includes("youtu.be")) return "youtube";
  if (lowered.includes("reddit.com")) return "reddit";
  if (lowered.includes("forum") || lowered.includes("advrider")) return "forum";
  if (lowered.includes("wikiloc") || lowered.includes("komoot") || lowered.includes("alltrails") || lowered.includes("openstreetmap")) return "map";
  if (lowered.includes(".gov") || lowered.includes("tourism") || lowered.includes("official")) return "official";
  if (lowered.includes("gpx")) return "gpx";
  return "blog";
}

function trustScore(url: string): number {
  const type = classifySource(url);
  if (type === "official") return 86;
  if (type === "map") return 78;
  if (type === "youtube" || type === "reddit" || type === "forum") return 52;
  return 62;
}
