# RouteMarket Atlas Engine

Backend production engine for RouteMarket Route Factory. Atlas implements the **Creator-Grade Pipeline** architecture, turning creator input into a reviewed route product package: research pack, GPX facts, claims, guide, quality report, and RouteMarket draft payload.

Atlas is intentionally strict and designed around a **human-in-the-loop approval process**. It completely replaces the old fully automated MVP concepts. The new pipeline is based on **rigorous quality gates**, zero tolerance for fallbacks or hallucinations, and relies purely on hard facts extracted from GPX data and creator notes. Publish preparation is actively blocked when the project contains weak, missing, or unvalidated route facts.

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

The pipeline requires human verification at key stages.

1. **Create Project**: Initialize a project in `routes/<slug>/`.
2. **Inputs**: Add creator notes, GPX files, and links to the project input manifest.
3. **Research**: Collect external sources and build `research_pack.json` combining creator inputs and deep research.
4. **GPX Analysis**: Analyze GPX data into `route_summary.json`, `route_segments.geojson`, `route_warnings.json`, and `elevation_profile.json`.
5. **Claims & POI**: Generate factual route claims (no meta-claims) and extract POIs.
6. **Approval Loop**: The workflow pauses for human validation. Approvals are required for: `gpx_summary_approval`, `claims_approval`, `poi_approval`, `concept_approval`, `guide_outline_approval`, and `guide_final_approval`.
7. **Final Draft**: Generate the final `guide.md` only when all required facts and approvals are present.
8. **Quality Gates**: Strict validation runs to prevent publishing if data is missing, placeholders exist, or GPX tracks are invalid.
9. **Publish**: Prepare `routemarket_payload.json` for handoff.

### Golden Route Demo

You can simulate the entire Creator-Grade Flow, from project creation through input addition, approvals, to final payload generation using the Golden Route demo:

```bash
npm run demo:golden-route
```

This runs an end-to-end smoke test showing how the Atlas Engine safely generates a complete route without hallucinations.

## CLI Commands

To manually step through the pipeline, use the CLI:

```bash
# 1. Create a project
npm run atlas -- create-project --topic "Golden Motorcycle Route" --category motorcycle --region Albania

# 2. Add inputs
npm run atlas -- input-add-note --project golden-motorcycle-route --file ./fixtures/golden-route/notes.md
npm run atlas -- input-add-gpx --project golden-motorcycle-route --file ./fixtures/golden-route/route.gpx
npm run atlas -- input-add-link --project golden-motorcycle-route --url "https://example.com/route-info"

# 3. Build Research Pack
npm run atlas -- build-research-pack --project golden-motorcycle-route

# 4. Analyze GPX
npm run atlas -- analyze-gpx --project golden-motorcycle-route

# 5. Extract Facts & POIs
npm run atlas -- generate-claims --project golden-motorcycle-route
npm run atlas -- extract-pois --project golden-motorcycle-route

# 6. Run automated workflow & human-in-the-loop approvals
# The `run-mvp2` command will pause when approvals are needed.
npm run atlas -- run-mvp2 --project golden-motorcycle-route
npm run atlas -- approve --project golden-motorcycle-route --stage gpx_summary_approval --decision approved
npm run atlas -- approve --project golden-motorcycle-route --stage claims_approval --decision approved
# ... (approve other required stages)

# 7. Quality Gates & Publish
npm run atlas -- prepare-publish --project golden-motorcycle-route
```

## Important Artifacts

- `input_manifest.json`: creator-provided notes, GPX files, documents, photos and links.
- `research_pack.json`: normalized creator materials and source summaries.
- `route_summary.json`: distance, elevation, timing estimate, loop type, validation status, route segments and warnings.
- `route_segments.geojson`: GPX-derived route segments geometry for map rendering.
- `route_warnings.json`: GPX analysis warnings (e.g., missing elevation, missing timestamps).
- `claims.json`: factual route claims only. Meta-claims are rejected.
- `missing_inputs.json`: blocking report when guide or publish preparation cannot continue due to incomplete data.
- `approvals.json`: human approval records. Approval side effects update related artifacts.
- `guide.md`: final guide, generated without fallbacks.
- `routemarket_payload.json`: draft payload for RouteMarket handoff.

## API

Core endpoints supporting the new pipeline:

```txt
POST /projects
POST /projects/:slug/inputs/notes
POST /projects/:slug/inputs/gpx
POST /projects/:slug/inputs/links
POST /projects/:slug/inputs/external
POST /projects/:slug/research-pack
POST /projects/:slug/analyze-gpx
POST /projects/:slug/run-mvp2
POST /projects/:slug/jobs/run-mvp2
POST /jobs/:id/approve
GET  /projects/:slug/review
POST /projects/:slug/prepare-publish
```

Full API contract: `docs/api_contract.md`.

## Quality Gates

Publish preparation is strictly blocked when:
- `missing_inputs.json` contains blocking issues.
- `guide.md` contains fallback text, TODOs, unknown placeholders, or generic filler.
- Required approvals (e.g., `guide_final_approval`) are missing.
- `route_segments.geojson` is missing when a GPX input is provided.
- Claims lack verification or GPX summary is unvalidated.

Approval side effects:
- GPX approval marks `route_summary.json` as `validated`.
- Claims approval upgrades eligible creator-review claims to `verified`.
- POI approval marks suggested POI as confirmed.

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
