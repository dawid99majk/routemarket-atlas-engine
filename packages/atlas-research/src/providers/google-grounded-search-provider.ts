import type { SearchInput, SearchProvider, SourceCandidate } from "./interfaces.js";

type GroundingChunk = {
  web?: {
    uri?: string;
    title?: string;
  };
};

type GeminiGroundedSearchOptions = {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export class GoogleGroundedSearchProvider implements SearchProvider {
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GeminiGroundedSearchOptions) {
    this.model = options.model ?? process.env.GEMINI_SEARCH_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async search(input: SearchInput): Promise<SourceCandidate[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 10, 20));
    const prompt = `Find high-quality web sources for a RouteMarket travel route project.

Query: ${input.query}
Category: ${input.category}
Region: ${input.region}
Language: ${input.language}

Return sources useful for factual route-guide generation: official tourism/local authorities, map or GPX sources, safety/access pages, strong route reports, relevant YouTube travel videos, and local forums.

Use Google Search grounding. Return concise JSON only:
{
  "sources": [
    {
      "url": "string",
      "title": "string",
      "summary": "string",
      "sourceType": "official|map|gpx|youtube|forum|reddit|blog|other",
      "relevanceScore": number,
      "trustScore": number
    }
  ]
}
Limit to ${limit} sources.`;

    const response = await this.fetchImpl(geminiGenerateContentUrl(this.model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.options.apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google grounded search failed with ${response.status}: ${errorText}`);
    }

    const payload = await response.json() as any;
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part: any) => typeof part.text === "string" ? part.text : "")
      .join("")
      .trim() ?? "";
    const groundingChunks = payload.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

    const parsedCandidates = parseCandidates(text, input.language);
    const groundedCandidates = candidatesFromGroundingChunks(groundingChunks, input.language);
    const merged = dedupeSources([...parsedCandidates, ...groundedCandidates]);

    return merged.slice(0, limit).map((candidate) => ({
      ...candidate,
      sourceType: candidate.sourceType ?? classifySource(candidate.url),
      relevanceScore: candidate.relevanceScore ?? 72,
      trustScore: candidate.trustScore ?? trustScore(candidate.url),
      licenseStatus: "unknown" as const,
      contentSummary: candidate.contentSummary ?? "Google Search grounded source candidate."
    }));
  }
}

function geminiGenerateContentUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

function parseCandidates(text: string, language: string): Partial<SourceCandidate>[] {
  if (!text.trim()) return [];
  try {
    const parsed = JSON.parse(stripJsonFence(text));
    const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
    return sources
      .filter((source: any) => source?.url && source?.title)
      .map((source: any) => ({
        url: String(source.url),
        title: String(source.title),
        sourceType: normalizeSourceType(source.sourceType ?? source.type ?? source.url),
        language,
        relevanceScore: finiteScore(source.relevanceScore, 72),
        trustScore: finiteScore(source.trustScore, trustScore(String(source.url))),
        contentSummary: typeof source.summary === "string" ? source.summary : typeof source.contentSummary === "string" ? source.contentSummary : ""
      }));
  } catch {
    return [];
  }
}

function candidatesFromGroundingChunks(chunks: GroundingChunk[], language: string): Partial<SourceCandidate>[] {
  if (!Array.isArray(chunks)) return [];
  return chunks
    .map((chunk) => chunk.web)
    .filter((web): web is { uri: string; title?: string } => Boolean(web?.uri))
    .map((web) => ({
      url: web.uri,
      title: web.title ?? web.uri,
      sourceType: classifySource(web.uri),
      language,
      relevanceScore: 68,
      trustScore: trustScore(web.uri),
      contentSummary: "Google Search grounding citation."
    }));
}

function dedupeSources(candidates: Partial<SourceCandidate>[]): SourceCandidate[] {
  const seen = new Set<string>();
  const result: SourceCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate.url || !candidate.title) continue;
    const key = canonicalUrl(candidate.url);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate as SourceCandidate);
  }
  return result;
}

function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (match) return match[1].trim();
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  return objectMatch ? objectMatch[0] : trimmed;
}

function normalizeSourceType(value: unknown): SourceCandidate["sourceType"] {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["official", "map", "gpx", "youtube", "forum", "reddit", "blog", "other"].includes(normalized)) {
    return normalized as SourceCandidate["sourceType"];
  }
  return classifySource(normalized);
}

function classifySource(url: string): SourceCandidate["sourceType"] {
  const lowered = url.toLowerCase();
  if (lowered.includes("youtube.com") || lowered.includes("youtu.be")) return "youtube";
  if (lowered.includes("reddit.com")) return "reddit";
  if (lowered.includes("forum") || lowered.includes("advrider")) return "forum";
  if (lowered.includes("wikiloc") || lowered.includes("komoot") || lowered.includes("alltrails") || lowered.includes("openstreetmap") || lowered.includes("google.com/maps")) return "map";
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

function finiteScore(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.min(Math.round(numberValue), 100));
}
