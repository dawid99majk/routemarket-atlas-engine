import type { DeepResearchProvider, DeepResearchExtractionResult, PoiCandidate } from "./interfaces.js";
import { SourceContentFetcher } from "./source-content-fetcher.js";

export class AnthropicDeepResearchProvider implements DeepResearchProvider {
  private fetcher = new SourceContentFetcher();

  constructor(private readonly apiKey: string) {}

  async scrapeAndExtract(sourceUrl: string, topicContext: string): Promise<DeepResearchExtractionResult> {
    let extractedText = "";
    try {
      extractedText = await this.fetcher.fetchText(sourceUrl);
    } catch (error) {
      console.warn(`Failed to fetch ${sourceUrl}:`, error);
      return { pois: [], claims: [], extractedText: "Failed to fetch content." };
    }

    const systemPrompt = `You are a specialized routing researcher. Extract Point of Interest (POI) candidates and claims (facts, warnings, safety notes) from the provided text about '${topicContext}'. Respond ONLY with valid JSON.`;
    
    const userPrompt = `Extract POIs and claims from the following text:\\n\\nTEXT:\\n${extractedText.slice(0, 50000)}\\n\\nReturn JSON matching this schema:
{
  "pois": [
    {
      "name": "string",
      "type": "viewpoint" | "water" | "food" | "shelter" | "landmark" | "hazard" | "other",
      "description": "string",
      "lat": number (optional, only if strictly mentioned),
      "lng": number (optional)
    }
  ],
  "claims": [
    {
      "claim": "string",
      "type": "poi" | "safety" | "season" | "distance" | "difficulty" | "logistics" | "route_segment",
      "confidence": number (1-100)
    }
  ]
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const textContent = data.content?.[0]?.text || "{}";
    
    let parsed: any = { pois: [], claims: [] };
    try {
      // Find json block if markdown formatted
      const jsonMatch = textContent.match(/\\{.*\\}/s);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : textContent);
    } catch (e) {
      console.warn("Failed to parse JSON from Anthropic:", textContent);
    }

    return {
      pois: Array.isArray(parsed.pois) ? parsed.pois.map((p: any) => ({ ...p, isVerifiedByDeepResearch: true })) : [],
      claims: Array.isArray(parsed.claims) ? parsed.claims : [],
      extractedText
    };
  }
}
