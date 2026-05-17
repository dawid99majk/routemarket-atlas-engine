import type { DeepResearchProvider, DeepResearchExtractionResult, PoiCandidate } from "./interfaces.js";
import { SourceContentFetcher } from "./source-content-fetcher.js";

type GeminiProviderOptions = {
  model?: string;
  fetchImpl?: typeof fetch;
};

export class GeminiDeepResearchProvider implements DeepResearchProvider {
  private readonly fetcher = new SourceContentFetcher();
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly apiKey: string, options: GeminiProviderOptions = {}) {
    this.model = options.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async scrapeAndExtract(sourceUrl: string, topicContext: string): Promise<DeepResearchExtractionResult> {
    let extractedText = "";
    try {
      extractedText = await this.fetcher.fetchText(sourceUrl);
    } catch (error) {
      console.warn(`Failed to fetch ${sourceUrl}:`, error);
      return { pois: [], claims: [], extractedText: "Failed to fetch content." };
    }

    const prompt = `You are RouteMarket Atlas, a strict travel-route research engine.

Goal: extract only factual, source-grounded route intelligence for: ${topicContext}.

Rules:
- Do not invent coordinates, names, opening hours, risks, distances, or POIs.
- If latitude/longitude are not explicitly present, omit lat/lng.
- Keep claims concrete and useful for route guide generation.
- Prefer safety, logistics, access, season, surface, distance, difficulty, and POI facts.
- Return only valid JSON. No markdown.

JSON schema:
{
  "pois": [
    {
      "name": "string",
      "type": "viewpoint|water|food|shelter|landmark|hazard|other",
      "description": "string",
      "lat": number,
      "lng": number
    }
  ],
  "claims": [
    {
      "claim": "string",
      "type": "poi|safety|season|distance|difficulty|logistics|route_segment",
      "confidence": number
    }
  ]
}

Confidence must be a number from 0 to 1.

SOURCE URL: ${sourceUrl}

TEXT:
${extractedText.slice(0, 60000)}`;

    const response = await this.fetchImpl(geminiGenerateContentUrl(this.model, this.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const textContent = data.candidates?.[0]?.content?.parts
      ?.map((part: any) => typeof part.text === "string" ? part.text : "")
      .join("")
      .trim() || "{}";

    let parsed: any = { pois: [], claims: [] };
    try {
      parsed = JSON.parse(stripJsonFence(textContent));
    } catch {
      console.warn("Failed to parse JSON from Gemini:", textContent.slice(0, 500));
    }

    return {
      pois: normalizePois(parsed.pois),
      claims: normalizeClaims(parsed.claims),
      extractedText
    };
  }
}

function geminiGenerateContentUrl(model: string, apiKey: string): string {
  const encodedModel = encodeURIComponent(model);
  const encodedKey = encodeURIComponent(apiKey);
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${encodedKey}`;
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (match) return match[1].trim();
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  return objectMatch ? objectMatch[0] : trimmed;
}

function normalizePois(value: unknown): PoiCandidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      name: String(item.name ?? "").trim(),
      type: normalizePoiType(item.type),
      description: typeof item.description === "string" ? item.description.trim() : undefined,
      lat: finiteOptionalNumber(item.lat),
      lng: finiteOptionalNumber(item.lng),
      isVerifiedByDeepResearch: true
    }))
    .filter((item) => item.name.length > 0);
}

function normalizeClaims(value: unknown): DeepResearchExtractionResult["claims"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      claim: String(item.claim ?? "").trim(),
      type: normalizeClaimType(item.type),
      confidence: normalizeConfidence(item.confidence)
    }))
    .filter((item) => item.claim.length > 0);
}

function normalizePoiType(value: unknown): PoiCandidate["type"] {
  const normalized = String(value ?? "other").trim().toLowerCase();
  if (["viewpoint", "water", "food", "shelter", "landmark", "hazard", "other"].includes(normalized)) {
    return normalized as PoiCandidate["type"];
  }
  if (["restaurant", "cafe", "bar"].includes(normalized)) return "food";
  if (["warning", "risk", "danger"].includes(normalized)) return "hazard";
  return "other";
}

function normalizeClaimType(value: unknown): string {
  const normalized = String(value ?? "logistics").trim().toLowerCase();
  if (["poi", "safety", "season", "distance", "difficulty", "logistics", "route_segment"].includes(normalized)) return normalized;
  if (normalized === "surface" || normalized === "access") return "logistics";
  return "logistics";
}

function normalizeConfidence(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0.5;
  if (numberValue > 1) return Math.max(0, Math.min(numberValue / 100, 1));
  return Math.max(0, Math.min(numberValue, 1));
}

function finiteOptionalNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}
