import type { DeepResearchProvider, DeepResearchExtractionResult } from "../providers/interfaces.js";

export class MockDeepResearchProvider implements DeepResearchProvider {
  async scrapeAndExtract(sourceUrl: string, topicContext: string): Promise<DeepResearchExtractionResult> {
    console.log(`[DeepResearch] Scraping ${sourceUrl} for context: ${topicContext}...`);
    
    // Simulate long-running deep research extraction
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      extractedText: "Mocked full text from deep research. Includes phone number +43 123 456 789 and prices 45 EUR.",
      pois: [
        {
          name: "Mocked Shelter Alpha",
          type: "shelter",
          description: "A very nice shelter.",
          contactPhone: "+43 123 456 789",
          priceRange: "45 EUR",
          waterAvailability: "available",
          facilities: ["wifi", "shower"],
          isVerifiedByDeepResearch: true
        }
      ],
      claims: [
        {
          claim: "Water is available year-round at Mocked Shelter Alpha",
          type: "logistics",
          confidence: 0.95
        }
      ]
    };
  }
}
