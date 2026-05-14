# RouteMarket Atlas Engine

Internal route production engine for discovering high-potential route topics, building research packs, and preparing RouteMarket drafts.

## MVP 1

- Demand Radar
- Research Pack
- Route project folder generation
- Mock provider interfaces
- Topic scoring
- CLI
- MCP server skeleton

## Commands

```bash
npm install
npm run atlas -- discover --category motorcycle --region Albania --language en
npm run atlas -- create-project --topic "Albania motorcycle route 7 days" --category motorcycle --region Albania --language en
npm run atlas -- collect-sources --project albania-motorcycle-route-7-days --provider auto
npm run atlas -- deep-research --project albania-motorcycle-route-7-days --source-limit 3
npm run atlas -- write-brief --project albania-motorcycle-route-7-days
npm run atlas -- write-concept --project albania-motorcycle-route-7-days
npm run atlas -- write-guide --project albania-motorcycle-route-7-days
npm run atlas -- quality-check --project albania-motorcycle-route-7-days
npm run atlas -- prepare-publish --project albania-motorcycle-route-7-days
npm run atlas -- run-mvp2 --project albania-motorcycle-route-7-days
npm run atlas -- review --project albania-motorcycle-route-7-days
npm run atlas -- review-decision --project albania-motorcycle-route-7-days --decision approved --reviewer "Atlas QA"
```

## Current CLI Commands

- `discover`: writes `data/backlog.json`.
- `create-project`: creates `routes/<slug>/`.
- `collect-sources`: writes `sources.json` using `--provider auto | mock | brave`.
- `deep-research`: enriches selected sources and writes `deep_research.json`.
- `write-brief`: writes `brief.md`.
- `write-concept`: writes `route_concept.md`.
- `write-guide`: writes `guide.md`.
- `quality-check`: writes `quality_report.md`.
- `validate-gpx`: runs basic GPX validation.
- `prepare-publish`: writes `routemarket_payload.json`.
- `generate-claims`: writes `claims.json`.
- `extract-pois`: writes `poi.geojson`.
- `generate-tips`: writes `tips.json`.
- `generate-recommendations`: writes `recommendations.json`.
- `prepare-media`: writes `media/manifest.json` and `media/license_report.md`.
- `write-review`: writes `review_checklist.md`.
- `status`: shows local project status.
- `run-mvp2`: runs the local MVP 2 pipeline for an existing project.
- `review`: shows readiness, source, claim, artifact, and decision summary.
- `review-decision`: saves a human review decision and updates project status.

## API

Atlas now includes a native HTTP API that can be embedded into a VPS setup and called by the future Lovable/RouteMarket application.

Run locally:

```bash
npm run api
```

Default URL:

```txt
http://localhost:8787
```

Useful endpoints:

```txt
GET  /health
GET  /version
GET  /providers
POST /discover
GET  /categories
GET  /dashboard
POST /projects
GET  /projects
GET  /projects/:slug
GET  /projects/:slug/bundle
GET  /projects/:slug/export
POST /projects/:slug/archive
GET  /projects/:slug/readiness
GET  /projects/:slug/review
POST /projects/:slug/review/decision
PATCH /projects/:slug/status
POST /projects/:slug/collect-sources
POST /projects/:slug/deep-research
POST /projects/:slug/run-mvp2
POST /projects/:slug/jobs/run-mvp2
POST /projects/:slug/prepare-publish
GET  /projects/:slug/artifacts
GET  /projects/:slug/events
GET  /jobs
POST /jobs/prune
GET  /jobs/:id
GET  /jobs/:id/logs
GET  /projects/:slug/files?path=guide.md
PUT  /projects/:slug/files?path=guide.md
```

For frontend use, prefer async jobs for longer workflows:

```ts
const started = await atlas.startRunMvp2Job("albania-motorcycle-route-7-days");
const status = await atlas.getJob(started.job.id);
const logs = await atlas.getJobLogs(started.job.id);
const events = await atlas.listProjectEvents("albania-motorcycle-route-7-days");
```

VPS notes are in `docs/vps_integration.md`.

API contract:

```txt
docs/api_contract.md
```

Deployment examples:

```txt
Dockerfile
deploy/docker-compose.example.yml
deploy/atlas-api.service.example
deploy/production.env.example
```

For VPS use, set:

```txt
ATLAS_API_TOKEN=<long random internal token>
ATLAS_CORS_ORIGIN=<your app origin>
ATLAS_LOG_REQUESTS=true
ATLAS_MAX_JOBS=200
BRAVE_SEARCH_API_KEY=<optional real web search key>
```

Source collection providers:

- `mock`: deterministic local fixtures for development and tests.
- `auto`: uses Brave Search when `BRAVE_SEARCH_API_KEY` is set, otherwise falls back to `mock`.
- `brave`: forces Brave Search and fails fast when the key is missing.

Check provider status locally:

```bash
npm run atlas -- providers
```

## MVP 2 Local Pipeline

After `collect-sources`, run:

```bash
npm run atlas -- run-mvp2 --project albania-motorcycle-route-7-days
```

This generates:

- `claims.json`,
- `poi.geojson`,
- `route_concept.md`,
- `guide.md`,
- `tips.json`,
- `recommendations.json`,
- `media/manifest.json`,
- `media/license_report.md`,
- `quality_report.md`,
- `review_checklist.md`,
- `routemarket_payload.json`.

Optional enrichment:

```bash
npm run atlas -- deep-research --project albania-motorcycle-route-7-days --source-limit 3
```

This writes `deep_research.json`, raw extracted text under `research/deep/`, marks processed sources, and appends extracted claims without overwriting human/deep research claims on later claim generation.

## RouteMarket Publishing

`prepare-publish` does not publish automatically. It prepares a structured payload that can be used with the RouteMarket MCP tools:

- `create_route_draft`,
- `add_route_tip`,
- `add_route_poi`,
- `attach_gpx_to_route`,
- `attach_image_to_route`,
- `add_route_recommendation`.

Atlas defaults to draft-first publishing. Human review remains required before setting a route to `published`.

## Quality Principle

Atlas Engine should create fewer routes, but with stronger source coverage, clearer risk labeling, and better human review.
