# Source Providers

Atlas source collection is provider-based. The workflow currently combines one web search provider with local video/forum fixtures.

## Modes

```txt
auto
mock
brave
```

- `auto`: default. Uses Brave Search when `BRAVE_SEARCH_API_KEY` exists, otherwise falls back to mock data.
- `mock`: deterministic local data for development, tests, and demos without external API keys.
- `brave`: forces Brave Search and fails fast if `BRAVE_SEARCH_API_KEY` is not configured.

## CLI

```bash
npm run atlas -- providers
npm run atlas -- collect-sources --project albania-motorcycle-route-7-days --provider auto --limit 20
npm run atlas -- collect-sources --project albania-motorcycle-route-7-days --provider mock
npm run atlas -- collect-sources --project albania-motorcycle-route-7-days --provider brave
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

Set this only when real web search should be active:

```txt
BRAVE_SEARCH_API_KEY=<your key>
```

Without the key, `auto` remains safe for local and VPS smoke flows because it falls back to `mock`.

## Deep Research Provider

Deep Research uses a separate provider interface:

```ts
DeepResearchProvider.scrapeAndExtract(sourceUrl, topicContext)
```

The current implementation ships with `MockDeepResearchProvider`, which lets the workflow, API, CLI, and frontend contract be tested before a real scraping/extraction backend is selected.
