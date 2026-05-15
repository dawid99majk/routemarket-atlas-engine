# RouteMarket Atlas Engine

Backend production engine for RouteMarket Route Factory. Atlas turns creator input into a reviewed route product package: research pack, GPX facts, claims, guide, quality report and RouteMarket draft payload.

Atlas is intentionally strict. The normal workflow pauses for human approvals and publish preparation is blocked when the project contains weak, missing or unvalidated route facts.

## Quick Start

```bash
npm install
npm run check
npm test
npm run demo:golden-route
npm run atlas -- --help
```

Run the HTTP API:

```bash
npm run api
```

Default local URL:

```txt
http://localhost:8787
```

## Creator-Grade Flow

1. Create a project in `routes/<slug>/`.
2. Add creator notes, GPX text and links into the project input manifest.
3. Collect external sources.
4. Build `research_pack.json` from creator inputs, sources and deep research.
5. Analyze GPX into `route_summary.json`, `route_segments.json`, `route_warnings.json` and `elevation_profile.json`.
6. Generate claims from GPX facts and creator notes.
7. Pause for approvals: GPX summary, claims, POI, concept, outline and final guide.
8. Generate the final guide only when required facts are present.
9. Run quality gates before `routemarket_payload.json` is prepared.

The golden route demo shows the full approval path:

```bash
npm run demo:golden-route
```

Generated route outputs under `routes/*` are ignored by git. Fixtures belong in `fixtures/`.

## Important Artifacts

- `input_manifest.json`: creator-provided notes, GPX files, documents, photos and links.
- `research_pack.json`: normalized creator materials and source summaries.
- `route_summary.json`: distance, elevation, timing estimate, loop type, validation status, route segments and warnings.
- `route_segments.json`: GPX-derived route segment list.
- `route_segments.geojson`: LineString segment geometry for map rendering and future 3D use.
- `route_warnings.json`: missing elevation/timestamps, invalid skipped points, suspicious short tracks.
- `claims.json`: factual route claims only. Meta-claims about sources are rejected.
- `missing_inputs.json`: blocking report when guide or publish preparation cannot continue.
- `approvals.json`: human approval records. Approval side effects update related artifacts.
- `workflow_state.json`: current workflow step, waiting approval stage, completed steps and artifact hashes.
- `guide.md`: final guide, only generated from sufficient verified inputs.
- `routemarket_payload.json`: draft payload for RouteMarket handoff.

## CLI

Useful commands:

```bash
npm run atlas -- create-project --topic "Albania motorcycle route 7 days" --category motorcycle --region Albania --language en
npm run atlas -- input-add-note --project albania-motorcycle-route-7-days --file ./notes.md
npm run atlas -- input-add-gpx --project albania-motorcycle-route-7-days --file ./route.gpx
npm run atlas -- input-add-link --project albania-motorcycle-route-7-days --url https://example.com/source
npm run atlas -- build-research-pack --project albania-motorcycle-route-7-days
npm run atlas -- analyze-gpx --project albania-motorcycle-route-7-days
npm run atlas -- run-mvp2 --project albania-motorcycle-route-7-days
npm run atlas -- approve --project albania-motorcycle-route-7-days --stage gpx_summary_approval --decision approved
npm run atlas -- prepare-publish --project albania-motorcycle-route-7-days
```

`run-mvp2` pauses at missing approvals by default. Auto approval is reserved for explicit demo/development paths and is ignored in production mode.

## API

The API is designed for the future RouteMarket creator UI, where the frontend should not write files directly.

Core endpoints:

```txt
GET  /health
GET  /version
GET  /manifest
POST /projects
POST /projects/:slug/inputs/notes
POST /projects/:slug/inputs/gpx
POST /projects/:slug/inputs/links
POST /projects/:slug/inputs/external
POST /projects/:slug/collect-sources
POST /projects/:slug/research-pack
POST /projects/:slug/analyze-gpx
POST /projects/:slug/run-mvp2
POST /projects/:slug/jobs/run-mvp2
POST /jobs/:id/approve
GET  /jobs/:id
GET  /projects/:slug/review
POST /projects/:slug/prepare-publish
```

Input endpoints accept JSON text payloads for now. Binary upload, OCR, camera/photo vision, mobile offline and RouteMarket frontend integration are intentionally out of scope for this sprint.

`inputs/external` registers a file already stored by RouteMarket using `storageUrl` or `storageKey`; Atlas records metadata and marks unsupported or parser-needed formats without fetching private URLs.

Full API contract: `docs/api_contract.md`.

## Quality Gates

Publish preparation is blocked when:

- blocking `missing_inputs.json` entries exist,
- source coverage is too weak or lacks trusted map/official sources,
- claims are missing, fake, uncertain or not approved,
- GPX summary is not validated,
- GPX-derived segments or warnings are missing,
- `route_segments.geojson` is missing when a GPX exists,
- final guide approval is missing,
- an approval is stale because the approved artifact hash no longer matches current content,
- the guide/description is too short,
- the guide contains fallback text, TODOs, unknown placeholders or generic filler,
- POI coordinates are invalid.

Approval side effects:

- GPX approval marks `route_summary.json` as `validated`.
- Claims approval upgrades eligible creator-review claims to `verified`.
- POI approval marks suggested POI as confirmed.
- Final guide approval is required before publish preparation.

## VPS Configuration

Production mode requires an API token and a restricted CORS origin:

```txt
ATLAS_API_TOKEN=<long random internal token>
ATLAS_CORS_ORIGIN=<RouteMarket app origin>
ATLAS_LOG_REQUESTS=true
ATLAS_MAX_JOBS=200
ATLAS_MAX_PERSISTED_LOGS=500
ATLAS_JOBS_DIR=<optional persistent job folder>
BRAVE_SEARCH_API_KEY=<optional real search provider>
```

If job persistence is enabled through the configured jobs directory, jobs waiting for approval survive API restarts.

Persisted job logs are kept as JSONL next to job state. Old completed/failed jobs can be pruned through the jobs API.

## MCP

The MCP server exposes the current creator-grade flow: project creation, note/GPX/link input, research pack building, GPX analysis, workflow execution, review, stage approval, safe file reads and publish preparation.

Run:

```bash
npm run mcp
```

Tool documentation: `docs/mcp_tools.md`.

## Quality Principle

Atlas should produce fewer route products, with stronger facts and clearer uncertainty. A blocked guide is better than a polished route that invents distance, surface, season or safety details.
