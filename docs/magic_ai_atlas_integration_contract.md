# Magic AI / Atlas integration contract

## Purpose

This contract defines how RouteMarket Magic AI talks to Atlas and how Atlas hands off a safe draft payload back to RouteMarket.

## User journey

The creator enters the Magic AI flow, not the manual creator. RouteMarket opens or creates an Atlas project, sends creator materials, waits for Atlas artifacts and only exposes draft import when Atlas marks the payload as safe to import.

## Atlas project lifecycle

States:

- `research_needed`
- `sources_collected`
- `draft_generated`
- `ready_for_review`
- `changes_requested`
- `blocked`
- `approved_for_publish`
- `archived`

Atlas project ownership:

- Atlas owns project files, approval state, artifact hashes, quality gates and import readiness.
- RouteMarket does not mutate Atlas artifacts directly.

## RouteMarket draft lifecycle

Draft states relevant to this contract:

- draft does not exist,
- draft imported from Atlas,
- draft manually edited after import,
- draft re-import conflict,
- published by human.

Atlas never publishes and never turns a draft into a live route.

## Payload import rules

Payload contract version: `2.1`

Creation source values:

- `manual`
- `atlas_ai`
- `manual_with_ai_suggestions`

Atlas payload fields required for import safety:

- `creationSource`
- `atlasProjectSlug`
- `payloadId`
- `generatedAt`
- `draftOnlyMode`
- `publishMode=draft`
- `sourceArtifactHashes`
- `importReadiness`
- `importPolicy`

Import rules:

- first import creates a RouteMarket draft,
- re-import updates the same Atlas-created draft only when it was not manually edited after the last import,
- if manual edits happened after import, RouteMarket must require explicit confirmation or create a new draft version,
- import never changes route status to published,
- manual media and manual edits are preserved unless overwrite is explicit,
- source artifact hashes are stored for conflict detection.

## Approval rules

Required approvals before safe import:

- `gpx_summary_approval`
- `claims_approval`
- `poi_approval`
- `concept_approval`
- `guide_outline_approval`
- `guide_final_approval`

If any approval is missing or stale, import readiness must block import.

## Failure states

- Atlas offline: manual creator remains available, Magic AI shows service unavailable.
- GPX missing: Atlas can continue research but import readiness blocks route import until required navigation artifacts are strong enough.
- Guide blocked: Atlas must write blocking reasons and keep payload import unavailable.
- Imported draft manually edited: re-import must show conflict instead of silent overwrite.
- Switch back to manual flow: creator may stop using Atlas and continue in RouteMarket editor without Atlas dependencies.

## UI states

Supported Magic AI UI states:

- `not_started`
- `collecting_inputs`
- `ready_to_run_atlas`
- `running`
- `waiting_for_approval`
- `changes_requested`
- `blocked_by_missing_inputs`
- `ready_to_import`
- `imported_to_draft`
- `import_conflict`
- `failed`

State behavior:

- `not_started`: user sees an empty flow; primary action is add inputs; import is not allowed.
- `collecting_inputs`: user sees current materials; primary action is run Atlas; import is not allowed.
- `ready_to_run_atlas`: user sees enough inputs; primary action is start Atlas; import is not allowed.
- `running`: user sees active pipeline progress; primary action is wait/view logs; import is not allowed.
- `waiting_for_approval`: user sees artifact preview and approval controls; primary action is approve or request changes; import is not allowed.
- `changes_requested`: user sees requested corrections; primary action is rerun or edit materials; import is not allowed.
- `blocked_by_missing_inputs`: user sees missing facts and blockers; primary action is add missing material; import is not allowed.
- `ready_to_import`: user sees import-safe payload; primary action is import to draft; live publish is not allowed.
- `imported_to_draft`: user sees a RouteMarket draft link; primary action is open manual editor; auto-publish is not allowed.
- `import_conflict`: user sees manual-edit conflict; primary action is confirm overwrite or create new draft version; silent overwrite is not allowed.
- `failed`: user sees error details; primary action is retry or return to manual flow; import is not allowed.

## Backend artifacts and endpoints

- project state: `project.json`
- approvals: `approvals.json`
- workflow state: `workflow_state.json`
- guide: `guide.md`
- claims: `claims.json`
- GPX analysis: `route_summary.json`, `route_segments.json`, `route_segments.geojson`, `route_warnings.json`
- RouteMarket handoff: `routemarket_payload.json`
- review bundle: `GET /projects/:slug/review`
- readiness bundle: `GET /projects/:slug/readiness`
- publish payload preparation: `POST /projects/:slug/prepare-publish`

## Security assumptions

- Atlas API is private and token-protected in production.
- RouteMarket is allowed to register external files but Atlas does not fetch private binary URLs by default.
- RouteMarket is the final publishing boundary and keeps the human audit trail.
- Atlas payload is safe for draft import only, never for direct live publishing.

## Manual creator independence

The manual creator must keep working with no Atlas project, no Atlas token, no Atlas approvals and no Atlas availability requirement.

## Payload to draft mapping

| Atlas payload field | RouteMarket draft field | Required | Import behavior |
| --- | --- | --- | --- |
| `draft.title` | `title` | yes | updated on safe re-import |
| `draft.description` | `description` | yes | updated on safe re-import |
| `guideText` | `full guide` | yes | updated on safe re-import |
| `draft.category_id` | `category` | yes | updated on safe re-import |
| `draft.location_string` | `location` | optional | updated on safe re-import |
| `draft.distance_km` | `distance` | optional | updated on safe re-import |
| `draft.elevation_gain_m` | `elevation` | optional | updated on safe re-import |
| `draft.estimated_time_h` | `estimated time` | optional | updated on safe re-import |
| `draft.difficulty` | `difficulty` | optional | updated on safe re-import |
| `draft.risk_level` | `risk level` | optional | updated on safe re-import |
| `draft.loop_type` | `loop type` | optional | updated on safe re-import |
| `draft.surface_type` | `surface type` | optional | updated on safe re-import |
| `draft.season` | `season` | optional | updated on safe re-import |
| `draft.start_point` | `start point` | optional | updated on safe re-import |
| `draft.end_point` | `end point` | optional | updated on safe re-import |
| `draft.tags` | `tags` | optional | merged unless overwrite is explicit |
| `pois` | `POI` | optional | merged carefully on safe re-import |
| `tips` | `tips` | optional | updated on safe re-import |
| `recommendations` | `recommendations` | optional | updated on safe re-import |
| `mediaManifest` | `media manifest` | optional | preserve manual media by default |
| `gpx.path` | `GPX reference` | optional | updated on safe re-import |
| `routeSummary.routeSegments` | `route segment reference` | optional | updated on safe re-import |
| `claimsSummary` | `claims summary` | optional | updated on safe re-import |
| `qualityGateResult` | `quality gate result` | yes | updated on safe re-import |

Protected after manual edit:

- any field explicitly changed in RouteMarket after the last Atlas import,
- manually added media,
- publication status.
