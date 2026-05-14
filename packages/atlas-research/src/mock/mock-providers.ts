import type {
  ForumProvider,
  SearchInput,
  SearchProvider,
  SourceCandidate,
  VideoProvider
} from "../providers/interfaces.js";

export class MockSearchProvider implements SearchProvider {
  async search(input: SearchInput): Promise<SourceCandidate[]> {
    const candidates: SourceCandidate[] = [
      {
        url: `https://example.com/${encodeURIComponent(input.region.toLowerCase())}-${input.category}-guide`,
        title: `${input.region} ${input.category} practical guide`,
        sourceType: "blog",
        language: input.language,
        relevanceScore: 82,
        trustScore: 64,
        licenseStatus: "unknown",
        contentSummary: `Mock travel guide source for ${input.query}.`
      },
      {
        url: `https://tourism.example.org/${encodeURIComponent(input.region.toLowerCase())}`,
        title: `${input.region} official tourism information`,
        sourceType: "official",
        language: input.language,
        relevanceScore: 76,
        trustScore: 86,
        licenseStatus: "needs_review",
        contentSummary: `Mock official tourism source for ${input.region}.`
      }
    ];
    return candidates.slice(0, input.limit ?? 10);
  }
}

export class MockVideoProvider implements VideoProvider {
  async searchVideos(input: SearchInput): Promise<SourceCandidate[]> {
    return [
      {
        url: `https://youtube.example.com/watch?v=${encodeURIComponent(input.region)}-${input.category}`,
        title: `${input.region} ${input.category} route video overview`,
        sourceType: "youtube",
        language: input.language,
        relevanceScore: 72,
        trustScore: 52,
        licenseStatus: "unknown",
        contentSummary: `Mock video source showing route context for ${input.query}.`
      }
    ];
  }
}

export class MockForumProvider implements ForumProvider {
  async searchDiscussions(input: SearchInput): Promise<SourceCandidate[]> {
    return [
      {
        url: `https://forum.example.net/${encodeURIComponent(input.region.toLowerCase())}-${input.category}`,
        title: `${input.region} ${input.category} traveler discussion`,
        sourceType: "forum",
        language: input.language,
        relevanceScore: 68,
        trustScore: 48,
        licenseStatus: "unknown",
        contentSummary: `Mock forum discussion with practical warnings for ${input.query}.`
      }
    ];
  }
}
