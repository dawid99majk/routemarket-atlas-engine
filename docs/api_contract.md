# Atlas API Contract

Base URL:

```txt
http://localhost:8787
```

## Auth

If `ATLAS_API_TOKEN` is set, every endpoint except `GET /health`, `GET /version`, and `GET /manifest` requires:

```txt
Authorization: Bearer <ATLAS_API_TOKEN>
```

or:

```txt
X-Atlas-API-Token: <ATLAS_API_TOKEN>
```

## Public

### GET /health

```json
{ "ok": true }
```

### GET /version

```json
{ "name": "routemarket-atlas-engine", "version": "0.1.0" }
```

### GET /manifest

Returns endpoint list and auth metadata.

## Project Creation

### POST /projects

```json
{
  "topic": "Albania motorcycle route 7 days",
  "category": "motorcycle",
  "region": "Albania",
  "language": "en"
}
```

Creates `routes/<slug>/` with starter files, empty approvals and input folders.

### GET /projects

Optional query params: `status`, `category`, `q`, `limit`, `offset`.

### GET /projects/:slug

Returns project metadata.

## Creator Input Endpoints

These endpoints support the new Creator-Grade Pipeline by allowing users to feed raw data (notes, GPX, links) into the engine before the workflow is triggered. They accept JSON text payloads.

### POST /projects/:slug/inputs/notes

```json
{
  "fileName": "creator-notes.md",
  "content": "Long route description and practical notes...",
  "note": "optional internal note"
}
```

Allowed extensions: `.md`, `.txt`. Max content size: 1 MB.
Useful for providing hard facts from the creator.

### POST /projects/:slug/inputs/gpx

```json
{
  "fileName": "route.gpx",
  "content": "<?xml version=\"1.0\"?><gpx>...</gpx>"
}
```

Allowed extension: `.gpx`. Max content size: 5 MB.
Required for spatial routing and GPX analysis.

### POST /projects/:slug/inputs/links

```json
{
  "url": "https://example.com/route-source",
  "note": "optional context"
}
```

### POST /projects/:slug/inputs/external

Registers a file already stored by RouteMarket or another storage service. Atlas records metadata only and does not fetch the file.

```json
{
  "type": "document",
  "originalName": "roadbook.pdf",
  "storageKey": "uploads/roadbook.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1234
}
```

## Research And GPX

### POST /projects/:slug/collect-sources

```json
{ "provider": "auto", "limit": 20 }
```

### POST /projects/:slug/research-pack

Builds the fundamental `research_pack.json` from creator-provided input manifest items and external sources. Required before the automated workflow can properly process facts.

### POST /projects/:slug/analyze-gpx

Analyzes provided GPX data without hallucinating missing fields (e.g., season or surface). Extracts precise facts into:
- `route_summary.json`
- `route_segments.json`
- `route_segments.geojson` (LineStrings for spatial mapping)
- `route_warnings.json` (Severity-based warnings for missing timestamps/elevation)
- `elevation_profile.json`

### POST /projects/:slug/deep-research

```json
{ "sourceLimit": 3 }
```

Writes `deep_research.json` and extracted claims/POIs.

## Workflow And Approvals

### POST /projects/:slug/run-mvp2

Runs the creator-grade workflow synchronously. It implements the Human-In-The-Loop paradigm by pausing at the first missing approval step:

```json
{
  "status": "paused",
  "step": "gpx",
  "stage": "gpx_summary_approval"
}
```

### POST /projects/:slug/jobs/run-mvp2

Starts the same workflow asynchronously as a tracked job.

### POST /jobs/:id/approve

Approves the pending stage for a job and triggers essential side-effects (e.g., changing claims status from `needs_creator_review` to `verified`, setting GPX summary as `validated`) before resuming the workflow.

```json
{ "approvalData": {} }
```

### GET /jobs/:id
### GET /jobs/:id/logs
### GET /jobs
### POST /jobs/prune

## Review And Artifacts

### GET /projects/:slug/readiness
### GET /projects/:slug/review

Returns project metadata, approval states, quality gate issues, and the next required action.

### POST /projects/:slug/review/decision

```json
{
  "decision": "approved",
  "reviewer": "Atlas QA",
  "notes": "Ready for publish handoff."
}
```

### GET /projects/:slug/artifacts
### GET /projects/:slug/events
### GET /projects/:slug/files?path=guide.md
### PUT /projects/:slug/files?path=guide.md

## Publish Preparation

### POST /projects/:slug/prepare-publish

Runs rigorous Quality Gates. It strictly blocks publish preparation if:
- A `blocking: true` flag is present in `missing_inputs.json`.
- `guide.md` contains fallback phrases (e.g. `todo`, `tbd`, `unknown`).
- GPX summary is unvalidated.
- The `guide_final_approval` (or any other required approval) is missing.
- GPX was provided but `route_segments.geojson` was not generated.

On failure:

```json
{
  "error": "Quality Gate Failed",
  "code": "quality_gate_failed",
  "details": [
    { "rule": "placeholder_in_guide", "message": "guide.md contains placeholder text: 'todo'." },
    { "rule": "missing_approval_guide_final_approval", "message": "Required approval missing: guide_final_approval" }
  ]
}
```

If it passes all Quality Gates, it successfully writes `routemarket_payload.json` compliant with the contract version.
