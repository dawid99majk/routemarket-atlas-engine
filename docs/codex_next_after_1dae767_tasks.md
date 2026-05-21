# Codex Next Tasks After Commit 1dae767

## Context

Commit `1dae767 Harden Atlas creator pipeline` moved Atlas Engine forward in the right direction. The project now has refreshed documentation, creator input API endpoints, GPX warnings and segments, stricter guide generation, stronger quality gates, job persistence and approval side effects.

This next sprint should focus on correctness, data contracts and integration readiness. Do not add the RouteMarket frontend, 3D map, OCR, mobile app or automatic publishing yet.

The target is a backend that can safely power RouteMarket Route Factory through API or MCP.

---

## 1. Run and record baseline status

Before changing code, run:

```bash
npm install
npm run check
npm test
npm run demo:golden-route
npm run atlas -- --help
```

Save the result in `docs/current_validation_status.md` with:

- date,
- commit SHA,
- command results,
- failing tests if any,
- known warnings.

Done when the repo has a clear validation snapshot for commit `1dae767`.

---

## 2. Normalize route segment contract

Current GPX analysis writes `route_segments.json`, while documentation and future map workflows will expect geospatial segment data. Decide and enforce one contract.

Preferred contract:

- keep `route_segments.json` for simple summary segments,
- add `route_segments.geojson` for map rendering and future 3D usage.

Tasks:

- Generate `route_segments.geojson` with LineString geometry.
- Keep each segment property small and stable: segment index, distance, elevation gain, point count, start, end.
- Add this artifact to allowed project files and artifact listing.
- Update quality gates to require `route_segments.geojson` when GPX exists.
- Update README/API contract.
- Add tests.

Done when a frontend can draw segment lines directly from `route_segments.geojson` without parsing GPX.

---

## 3. GPX parser route-point fallback

Current parser handles track points but still needs reliable route point fallback.

Tasks:

- If no track points exist, parse route points.
- Preserve warnings indicating whether source data came from track points or route points.
- Skip invalid points safely and report count of skipped points.
- Add tests for track points, route points, single quotes in attributes and invalid coordinates.

Done when GPX files with route points only can still be analyzed.

---

## 4. Approval side effects must be conservative

Current approval effects are too broad. In particular, claims approval upgrades all uncertain claims to verified. That is unsafe.

Tasks:

- For claims approval, only upgrade claims that are eligible.
- Creator claims can become verified only if their source is a creator material and the approval stage is claims approval.
- Multi-source uncertain claims can become likely, not verified.
- Technical GPX claims can become verified only after GPX summary approval.
- Unknown-source claims should remain uncertain.
- Add a small audit section to `approvals.json` or event data showing how many claims changed.

POI approval should also update `poi_candidates.json`, not only `poi.geojson`.

Done when approval does not blindly mark everything as verified.

---

## 5. Workflow resume should not regenerate approved artifacts unnecessarily

Current workflow resume can restart from a step and regenerate artifacts that were already reviewed. That risks overwriting approved work.

Tasks:

- Store explicit workflow state in a project file, for example `workflow_state.json`.
- Track current step, next step, waiting approval stage, completed steps and generated artifact hashes.
- When a stage is approved, resume from the exact next step.
- Do not regenerate approved artifacts unless the user requested changes or input files changed.
- If input changes after approval, mark dependent approvals stale.

Done when approval resume is deterministic and does not accidentally overwrite reviewed files.

---

## 6. Stale approval detection

If creator input, GPX, research pack, claims, POI or guide changes after approval, related approvals should become stale.

Tasks:

- Add content hashes for important artifacts.
- Store artifact hashes in approval records.
- On quality check, detect if approved artifact hash no longer matches current artifact.
- Add quality issue for stale approval.
- Add tests for changing `claims.json` after claims approval.

Done when approvals are tied to exact artifact versions, not just stage names.

---

## 7. Guide v2 should block weak sections, not fill them

Guide v2 is much better, but it still has fallback lines like no reviewed facts, no approved POI and generic preparation advice.

Tasks:

- Define which guide sections are mandatory by category.
- For motorcycle routes, require logistics, safety, route summary and at least one practical claim.
- For hiking/trekking routes, require safety, season/weather note and water/gear/logistics facts.
- If a mandatory section lacks reviewed facts, write `missing_inputs.json` and do not produce final guide.
- Keep generic disclaimer, but do not use generic content as a substitute for route facts.

Done when guide sections are fact-backed or blocked.

---

## 8. Claims need source traceability in guide

The final guide should allow a reviewer to see which claims support which sections.

Tasks:

- Add `usedInSections` updates when guide v2 uses a claim.
- Add a `sources_and_verification` block that references source IDs and creator materials.
- Update `claims.json` after guide generation with section usage.
- Add a review summary: section name, claims used, missing facts.

Done when a reviewer can trace guide content back to claims and materials.

---

## 9. Input API should support document metadata without parsing

Binary and OCR are still out of scope, but the future UI needs a way to register uploaded files stored elsewhere.

Tasks:

- Add an API method to register an external input file by URL or storage key.
- Store type, original filename, storage location, mime type, size and status.
- Mark unsupported formats as unsupported or needs parser, not usable.
- Do not fetch private URLs yet unless a safe backend fetcher is implemented.

Done when RouteMarket app can tell Atlas that a file exists, even if Atlas cannot parse it yet.

---

## 10. Publish payload contract v2

`routemarket_payload.json` should become a stable integration contract for the RouteMarket app.

Tasks:

- Define a version field in the payload.
- Include route summary, guide text, POI, tips, recommendations, media manifest, GPX path, claims summary and quality gate result.
- Add an explicit `publishMode` field set to draft only.
- Add `canImportToRouteMarket` boolean based on quality gates.
- Add tests for payload shape.

Done when frontend/import code can rely on a stable payload format.

---

## 11. API review bundle for frontend

Future UI should not call many file endpoints to understand project state.

Tasks:

- Extend review/readiness response with workflow state, approval state, missing inputs, quality issues, artifact hashes and next recommended action.
- Add a small `nextAction` object: type, label, stage, blocking reason.
- Keep response compact enough for UI polling.

Done when one API call can power a creator review screen.

---

## 12. MCP tool parity

MCP should match the API creator-grade flow.

Tasks:

- Verify MCP tools exist for create project, add note, add GPX text, add link, build research pack, analyze GPX, run workflow, approve stage, get review bundle, read project file and prepare publish.
- Return stable JSON, not human-only text.
- Add docs in `docs/mcp_tools.md`.
- Add a smoke test or script that runs the golden route flow through MCP-compatible service methods.

Done when an agent can operate Atlas without CLI.

---

## 13. Job persistence hardening

Job persistence was added, but needs operational checks.

Tasks:

- Confirm waiting approval jobs survive restart.
- Ensure project locks are restored correctly.
- Add a cleanup command for old persisted jobs.
- Add max persisted logs or log rotation.
- Document job persistence env variables.

Done when a VPS restart does not break an active creator review flow.

---

## 14. Golden route should test stricter truthfulness

The golden route smoke test should fail on weak output.

Tasks:

- Assert final guide has no generic filler phrases.
- Assert route summary is validated before publish preparation.
- Assert claims approval changed only eligible claims.
- Assert route segments GeoJSON exists.
- Assert payload says draft/import only, never published.

Done when golden route protects against regression into fake-quality output.

---

## 15. Remove or clearly label legacy commands

Legacy `write-guide` and legacy guide draft can create weak shells. They are useful for compatibility but dangerous if confused with final guide generation.

Tasks:

- Rename or document legacy commands clearly.
- Add warnings when legacy guide generation is used.
- Ensure quality gates block legacy guide output.

Done when there is no ambiguity between old draft shell and final guide v2.

---

## Final validation checklist

Before finishing this sprint, run:

```bash
npm run check
npm test
npm run demo:golden-route
npm run atlas -- --help
```

Manual checks:

1. Workflow pauses on approvals by default.
2. Approval resume starts at exact next step.
3. Changing input after approval marks approval stale.
4. GPX route-only file is analyzed.
5. Segment GeoJSON exists.
6. Guide is blocked when mandatory facts are missing.
7. Payload is stable and draft-only.
8. Review bundle exposes the next action for UI.

## Out of scope

Do not build the RouteMarket frontend, 3D map, OCR, vision model, mobile/offline app, payments or automatic publishing in this sprint.
