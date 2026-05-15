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

These endpoints are the handoff for future RouteMarket creator UI. They accept JSON text payloads only; binary upload is out of scope.

### POST /projects/:slug/inputs/notes

```json
{
  "fileName": "creator-notes.md",
  "content": "Long route description and practical notes...",
  "note": "optional internal note"
}
```

Allowed extensions: `.md`, `.txt`. Max content size: 1 MB.

### POST /projects/:slug/inputs/gpx

```json
{
  "fileName": "route.gpx",
  "content": "<?xml version=\"1.0\"?><gpx>...</gpx>"
}
```

Allowed extension: `.gpx`. Max content size: 5 MB.

### POST /projects/:slug/inputs/links

```json
{
  "url": "https://example.com/route-source",
  "note": "optional context"
}
```

Filenames are sanitized. Path traversal and wrong extensions return HTTP 400.

## Research And GPX

### POST /projects/:slug/collect-sources

```json
{ "provider": "auto", "limit": 20 }
```

Provider modes: `auto`, `mock`, `brave`.

### POST /projects/:slug/research-pack

Builds `research_pack.json` from input manifest items, collected sources and deep research.

### POST /projects/:slug/analyze-gpx

Analyzes GPX and writes:

- `route_summary.json`
- `route_segments.json`
- `route_warnings.json`
- `elevation_profile.json`

The analyzer does not infer season or surface unless data supports it. It records warnings for missing elevation, missing timestamps, invalid skipped points and suspiciously short tracks.

### POST /projects/:slug/deep-research

```json
{ "sourceLimit": 3 }
```

Writes `deep_research.json`, raw extracted text under `research/deep/`, extracted claims and mapped POI when possible.

## Workflow And Approvals

### POST /projects/:slug/run-mvp2

Runs the creator-grade workflow synchronously. It pauses at the first missing approval:

```json
{
  "status": "paused",
  "step": "gpx",
  "stage": "gpx_summary_approval"
}
```

Normal workflow execution does not auto-approve stages.

### POST /projects/:slug/jobs/run-mvp2

Starts the same workflow asynchronously:

```json
{
  "job": {
    "id": "job_...",
    "type": "run-mvp2:project-slug",
    "status": "queued"
  }
}
```

### POST /jobs/:id/approve

Approves the pending stage for a job and resumes the next workflow step:

```json
{ "approvalData": {} }
```

Approval side effects update artifacts: GPX validation status, claim statuses and POI status.

### GET /jobs/:id

Statuses: `queued`, `running`, `waiting_for_approval`, `completed`, `failed`.

Waiting approval jobs can be restored from file-based job persistence.

### GET /jobs/:id/logs

Returns job log entries.

### GET /jobs

Lists jobs.

### POST /jobs/prune

```json
{ "olderThanMs": 3600000 }
```

Removes completed/failed jobs.

## Review And Artifacts

### GET /projects/:slug/readiness

Returns automated readiness status, score, checks and blocking/warning counts.

### GET /projects/:slug/review

Returns project metadata, readiness, source summary, claim summary, artifact summary, latest decision and recent events.

### POST /projects/:slug/review/decision

```json
{
  "decision": "approved",
  "reviewer": "Atlas QA",
  "notes": "Ready for publish handoff."
}
```

Decision mapping:

- `approved` -> `approved_for_publish`
- `changes_requested` -> `changes_requested`
- `blocked` -> `blocked`

### GET /projects/:slug/artifacts

Returns known artifact metadata.

### GET /projects/:slug/events

Returns timeline events.

### GET /projects/:slug/files?path=guide.md

Reads a safe allow-listed artifact.

### PUT /projects/:slug/files?path=guide.md

Writes allow-listed editable artifacts only.

```json
{ "content": "# Edited guide" }
```

## Publish Preparation

### POST /projects/:slug/prepare-publish

Runs quality gates and writes `routemarket_payload.json` only if the project is strong enough.

On failure:

```json
{
  "error": "Quality Gate Failed",
  "code": "quality_gate_failed",
  "details": [
    { "rule": "summary_not_validated", "message": "GPX route summary must be validated before publish preparation." }
  ]
}
```

Publish is blocked by missing inputs, weak guide text, missing approvals, missing GPX segments/warnings, unvalidated GPX summary, insufficient claims, weak source coverage or invalid POI coordinates.
