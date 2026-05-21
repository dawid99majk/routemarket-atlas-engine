# Source Providers

Atlas source collection is provider-based. The workflow combines one web search provider with local video/forum fixtures.

## Modes

```txt
auto
mock
google
```

- `auto`: default. Uses Gemini Grounding with Google Search when `GEMINI_API_KEY` or `GOOGLE_API_KEY` exists, otherwise falls back to mock data.
- `mock`: deterministic local data for development, tests, and demos without external API keys.
- `google`: forces Gemini Grounding with Google Search and fails fast if no Google/Gemini key is configured.

## CLI

```bash
npm run atlas -- providers
npm run atlas -- collect-sources --project albania-motorcycle-route-7-days --provider auto --limit 20
npm run atlas -- collect-sources --project albania-motorcycle-route-7-days --provider mock
npm run atlas -- collect-sources --project albania-motorcycle-route-7-days --provider google
```

## API

```http
GET /providers
Authorization: Bearer <ATLAS_API_TOKEN>
```

```http
POST /projects/albania-motorcycle-route-7-days/collect-sources
Content-Type: application/json
Authorization: Bearer <ATLAS_API_TOKEN>

{
  "provider": "auto",
  "limit": 20
}
```

## VPS

Set this only when real Google-backed search should be active:

```txt
GEMINI_API_KEY=<your key>
GEMINI_MODEL=gemini-2.5-flash
```

Without the key, `auto` remains safe for local and VPS smoke flows because it falls back to `mock`.

## Deep Research Provider

Deep Research uses a separate provider interface:

```ts
DeepResearchProvider.scrapeAndExtract(sourceUrl, topicContext)
```

Set `GEMINI_API_KEY` to enable real deep research extraction. Optional: set `GEMINI_MODEL` (defaults to `gemini-2.5-flash`). Google Places enrichment uses `GOOGLE_MAPS_API_KEY` or `GOOGLE_API_KEY` when available.
