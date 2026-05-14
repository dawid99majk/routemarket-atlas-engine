# Atlas API Contract

Base URL locally:

```txt
http://localhost:8787
```

## Auth

If `ATLAS_API_TOKEN` is set, all endpoints except `GET /health`, `GET /version`, and `GET /manifest` require:

```txt
Authorization: Bearer <ATLAS_API_TOKEN>
```

or:

```txt
X-Atlas-API-Token: <ATLAS_API_TOKEN>
```

## Public Endpoints

### GET /health

```json
{ "ok": true }
```

### GET /version

```json
{
  "name": "routemarket-atlas-engine",
  "version": "0.1.0"
}
```

### GET /manifest

Returns available endpoints and whether auth is enabled.

## Private Endpoints

### GET /categories

Returns Atlas categories and RouteMarket category IDs where known.

### GET /providers

Returns source provider availability without exposing API keys.

```json
{
  "defaultProvider": "mock",
  "providers": [
    {
      "id": "mock",
      "name": "Mock local fixtures",
      "configured": true,
      "activeByDefault": true,
      "notes": "Always available for tests, demos, and offline development."
    }
  ]
}
```

### GET /dashboard

Returns project counts by status/category plus recent projects.

### POST /discover

Body:

```json
{
  "category": "motorcycle",
  "region": "Albania",
  "language": "en",
  "limit": 10
}
```

### POST /projects

Body:

```json
{
  "topic": "Albania motorcycle route 7 days",
  "category": "motorcycle",
  "region": "Albania",
  "language": "en"
}
```

### GET /projects

Lists local route projects.

Optional query params:

- `status`
- `category`
- `q`
- `limit`
- `offset`

### GET /projects/:slug

Returns local project metadata.

### GET /projects/:slug/bundle

Returns project metadata, artifacts, and timeline events in one response for admin screens.

### GET /projects/:slug/export

Returns a JSON export bundle with project metadata, artifact metadata/content, and timeline events.

### POST /projects/:slug/archive

Sets project status to `archived` and logs an archive event.

Body:

```json
{
  "reason": "Duplicate or no longer useful"
}
```

### GET /projects/:slug/readiness

Returns automated review readiness:

- `status`: `ready`, `needs_review`, or `blocked`,
- `score`: 0-100,
- `checks`,
- `blockingCount`,
- `warningCount`.

### GET /projects/:slug/review

Returns a review bundle for admin screens:

- project metadata,
- automated readiness,
- source summary,
- claim summary,
- required artifact summary,
- latest saved review decision,
- recent project events.

### POST /projects/:slug/review/decision

Saves a human review decision, writes `review_decision.json`, logs `review.decision`, and updates project status.

Body:

```json
{
  "decision": "approved",
  "reviewer": "Atlas QA",
  "notes": "Ready for publish handoff."
}
```

Decision to status mapping:

- `approved` -> `approved_for_publish`
- `changes_requested` -> `changes_requested`
- `blocked` -> `blocked`

### PATCH /projects/:slug/status

Body:

```json
{
  "status": "ready_for_review"
}
```

### GET /projects/:slug/artifacts

Returns known project artifacts with existence, size, and update metadata.

### GET /projects/:slug/events

Returns project timeline events such as source collection, workflow steps, and status changes.

### POST /projects/:slug/collect-sources

Collects mock/provider sources.

Body:

```json
{
  "provider": "auto",
  "limit": 20
}
```

Provider modes:

- `auto`: use Brave Search when `BRAVE_SEARCH_API_KEY` exists, otherwise use mock data.
- `mock`: deterministic local development data.
- `brave`: require Brave Search and return an error when `BRAVE_SEARCH_API_KEY` is missing.

### POST /projects/:slug/deep-research

Runs deep extraction on collected sources. The current implementation uses the provider interface and mock extractor by default.

Body:

```json
{
  "sourceLimit": 3
}
```

Writes:

- `deep_research.json`
- `research/deep/source_001.txt`
- updated `sources.json` with `rawContentPath` and `deepResearchStatus`
- updated `claims.json` with extracted claims
- updated `poi.geojson` when extracted POI can be mapped or has coordinates

### POST /projects/:slug/run-mvp2

Runs local MVP 2 workflow and sets project status to `ready_for_review`.

### POST /projects/:slug/jobs/run-mvp2

Starts the MVP 2 workflow asynchronously.

Response:

```json
{
  "job": {
    "id": "job_...",
    "type": "run-mvp2:project-slug",
    "status": "queued"
  }
}
```

### GET /jobs

Lists in-memory jobs for the current API process.

### POST /jobs/prune

Removes completed/failed jobs from memory.

Body:

```json
{
  "olderThanMs": 3600000
}
```

### GET /jobs/:id

Returns one job status. Job statuses:

- `queued`
- `running`
- `completed`
- `failed`

The job object includes:

- `progress`: number from 0 to 100,
- `currentStep`,
- `logs`,
- `result` when completed,
- `error` when failed.

### GET /jobs/:id/logs

Returns only job log entries.

### POST /projects/:slug/prepare-publish

Writes `routemarket_payload.json`.

**Note:** This endpoint is protected by Quality Gates and will return HTTP 422 `quality_gate_failed` with a list of issues if the project does not meet strict quality thresholds (e.g., sufficient sources, valid POIs, no placeholder text).

### GET /projects/:slug/files?path=guide.md

Reads an allowed project file. Only safe known project artifacts are readable.

### PUT /projects/:slug/files?path=guide.md

Writes an allowed editable project file. Writable files are intentionally limited to review/editing artifacts such as:

- `brief.md`
- `notes.md`
- `route_concept.md`
- `guide.md`
- `quality_report.md`
- `review_checklist.md`
- `media/license_report.md`

Body:

```json
{
  "content": "# Edited guide"
}
```
