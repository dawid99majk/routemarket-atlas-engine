# MCP Tools

Atlas MCP exposes the same creator-grade flow as the CLI/API, so an agent can build a route project without direct filesystem writes.

## Creator Flow Tools

### create_route_project

Creates `routes/<slug>/` with starter artifacts, input folders and empty approvals.

### add_note

Adds creator note text to `input/notes/` and updates `input_manifest.json`.

### add_gpx_text

Adds GPX XML text to `input/gpx/` and updates `input_manifest.json`.

### add_link

Adds an external source URL to the input manifest.

### register_external_input

Registers metadata for a file stored outside Atlas. It does not fetch private URLs.

### collect_sources

Collects provider sources with the mock/Google provider interface.

### build_research_pack

Writes `research_pack.json` from creator input, links, collected sources and deep research.

### analyze_gpx

Writes `route_summary.json`, `route_segments.json`, `route_warnings.json` and `elevation_profile.json`.
Also writes `route_segments.geojson` for frontend map rendering.

### generate_claims

Writes factual route claims. Meta-claims about sources are rejected.

### extract_pois

Writes `poi.geojson`.

### generate_route_concept

Writes `route_concept.md`.

### generate_guide_draft

Legacy draft helper. The production workflow should prefer `run_workflow`, which uses guide v2 and approval gates.

### run_workflow

Runs the creator-grade workflow. It pauses at missing approvals by default.

### approve_stage

Writes a stage approval and applies side effects:

- GPX approval marks the route summary as validated.
- Claims approval upgrades eligible review claims.
- POI approval confirms suggested candidates.

### get_review

Returns readiness, quality issues, source summary, claim summary and recent events.
Also returns approval state, missing inputs, artifact hashes and `nextAction`.

### read_project_file

Reads a safe allow-listed project artifact.

### quality_check

Writes `quality_report.md`.

### prepare_routemarket_draft

Runs quality gates and writes `routemarket_payload.json` when the project is approved and strong enough.

## Supporting Tools

- `discover_demand`
- `generate_research_brief`
- `generate_route_tips`
- `generate_recommendations`
- `prepare_media_pack`
- `write_review_checklist`

## RouteMarket Handoff

Atlas Publisher prepares a draft-first payload for RouteMarket. Actual publication remains a separate human-approved step.
