# Codex Next Tasks After Workflow State Hardening

## Context

The branch `feat/creator-grade-atlas-pipeline` is now ahead of commit `1dae767` and includes another hardening round:

- validation snapshot document,
- workflow state file,
- artifact hashes,
- stale approval checks,
- better approval side effects,
- route segment GeoJSON,
- GPX route-point fallback,
- payload contract v2,
- API/client additions,
- MCP documentation updates,
- more tests.

This is good progress. The next sprint should focus on closing correctness gaps and making the system predictable for a future RouteMarket frontend.

Do not build the frontend, 3D map, OCR, image vision, automatic publishing, payments or mobile/offline features in this sprint.

---

## 1. Refresh validation snapshot

Update `docs/current_validation_status.md` after this branch state.

Run:

```bash
npm install
npm run check
npm test
npm run demo:golden-route
npm run atlas -- --help
```

Record:

- current commit SHA,
- command results,
- test count,
- known warnings,
- whether demo leaves ignored files behind.

Done when the validation doc reflects the newest branch state, not the older `97814749` snapshot.

---

## 2. Fix stale approval false positives

Artifact hash tracking is now present, but approvals can become stale because a file was missing during approval and still missing later. That should not always be treated as stale.

Tasks:

- In stale approval detection, compare only files that were present when approved, unless the file is required for that approval stage.
- Add a clear rule for required vs optional files per approval stage.
- If an optional artifact is missing both before and after approval, do not mark the approval stale.
- If a required artifact is missing at approval time, approval should be rejected or recorded as invalid.
- Add tests for missing optional files and changed required files.

Done when stale approval detection is precise and does not create false blocking issues.

---

## 3. Make GPX existence detection input-aware

Quality gates currently check some GPX-related requirements using direct project files. But GPX can be stored through the input manifest.

Tasks:

- Add a shared helper that detects whether the project has GPX from either `route.gpx` or `input_manifest.json`.
- Use that helper in quality gates, publisher, review bundle and workflow decisions.
- If GPX exists through input manifest, require route summary, route warnings and route segments GeoJSON.
- If no GPX exists, decide explicitly whether the category allows non-GPX routes. For now, most route categories should require GPX.

Done when quality gates behave the same for direct `route.gpx` and input-manifest GPX.

---

## 4. Align route segment artifact names everywhere

The code now writes both segment summary and segment GeoJSON. Make the contract explicit and consistent.

Tasks:

- Use `route_segments.json` for segment summary.
- Use `route_segments.geojson` for map rendering.
- Ensure both appear in artifact listing, allowed file reads, export bundle, review bundle and docs.
- Ensure quality gates require GeoJSON when GPX exists.
- Ensure the publisher includes both references in payload v2.

Done when there is no ambiguity between segment summary and geospatial segment data.

---

## 5. Workflow state must drive resume, not approval guessing

Workflow state exists, but resume logic should be fully deterministic.

Tasks:

- Every workflow step should write `workflow_state.json` with completed step, next step and waiting approval stage.
- Job approval resume should read `workflow_state.json` and use its `nextStep` instead of hardcoded stage maps where possible.
- If workflow state is missing, fall back safely and log a warning.
- If an artifact changed after approval, mark affected steps as stale and do not resume blindly.
- Add tests for resume after GPX approval and claims approval.

Done when workflow resume starts exactly where expected and does not regenerate approved artifacts unnecessarily.

---

## 6. Approval side effects should update approval hashes after mutation

Current approval side effects mutate artifacts after the approval record is initially built. This is good, but needs strict testing.

Tasks:

- Confirm approval record stores hashes after all side effects are complete.
- Add tests for GPX approval: route summary is validated and approval hash matches the validated file.
- Add tests for claims approval: changed claim statuses are reflected in the stored approval hash.
- Add tests for POI approval with `poi_candidates.json` and `poi.geojson`.

Done when approval hash data represents the final approved artifact, not the pre-side-effect version.

---

## 7. Claims traceability improvements

Guide v2 should not only use claims. It should record where each claim was used.

Tasks:

- When guide generation uses a claim, update its `usedInSections` field.
- Keep `usedInSections` out of the hash comparison if it changes only because guide usage changed, unless the claim text/status/source changed.
- Add a section usage report, for example `guide_traceability.json`.
- Report sections with no supporting claims.
- Add tests that guide generation updates claim usage.

Done when reviewers can trace guide sections back to claims and source IDs.

---

## 8. Guide mandatory facts by category

Guide v2 still contains acceptable generic editorial text, but mandatory practical sections should be fact-backed.

Tasks:

- Define mandatory fact groups per category.
- Motorcycle should require at least distance, route type, logistics and safety/risk facts.
- Hiking/trekking should require distance, elevation or elevation warning, safety/risk, season/weather or explicit unknown warning, and water/gear/logistics facts.
- Cycling should require distance, elevation, surface or explicit unknown warning, logistics and safety facts.
- If mandatory facts are missing, write blocking `missing_inputs.json` and skip final guide generation.
- Add tests for motorcycle and hiking.

Done when guide generation blocks missing practical sections instead of filling them with generic advice.

---

## 9. Payload v2 contract hardening

Payload v2 exists, but it should become a stable integration artifact for RouteMarket import.

Tasks:

- Add schema validation for `routemarket_payload.json`.
- Include references to `route_segments.json`, `route_segments.geojson`, `route_warnings.json` and `guide_traceability.json` when present.
- Add `sourceArtifactHashes` for key files used to build the payload.
- Add `generatedAt` and `payloadId`.
- Ensure `publishMode` is always draft-only for now.
- Ensure `canImportToRouteMarket` is false if quality gates do not pass.
- Add tests for payload shape and draft-only behavior.

Done when the frontend can trust payload v2 without reverse-engineering project folders.

---

## 10. Review bundle should be UI-ready

The review bundle now includes workflow state, missing inputs, hashes and next action. Make it reliable enough for a UI screen.

Tasks:

- Add stable response types for review bundle.
- Ensure `nextAction` has predictable fields: type, label, stage, reason and recommended artifact.
- Include a compact list of pending approvals.
- Include stale approvals with affected files.
- Include missing inputs grouped by required stage.
- Add tests for `nextAction` priority: blocking missing inputs first, stale approvals second, pending approvals third, quality issues fourth.

Done when one review endpoint response can drive a creator approval panel.

---

## 11. API and client parity tests

Client methods were added for new endpoints. Verify they match the API exactly.

Tasks:

- Add tests for AtlasClient URL construction and request body shape.
- Add tests for note input, GPX input, external input registration, research pack, GPX analysis and approval job calls.
- Ensure API contract docs match actual routes.
- Add a lightweight manifest test verifying every documented route exists in API manifest.

Done when client, docs and API routes do not drift.

---

## 12. External input registration hardening

External input registration is useful for future frontend handoff, but must be strict.

Tasks:

- Validate allowed input types and MIME types.
- Store external inputs with status `registered`, `unsupported`, `needs_parser` or `usable`.
- Do not mark external documents/photos as usable unless Atlas can actually process them.
- Add optional storage key support separately from URL.
- Add tests for unsupported document/photo registration.

Done when external file registration is honest and safe.

---

## 13. MCP end-to-end smoke path

MCP docs were updated, but we need confidence that the service flow can be driven like an agent would drive it.

Tasks:

- Add a script or test that calls the same service methods exposed by MCP for golden route flow.
- It should create project, add note, add GPX, build research pack, analyze GPX, run workflow, approve stages, review and prepare publish.
- The test can avoid actual MCP transport, but should validate MCP tool parity with service methods.

Done when agent-style usage is protected by tests.

---

## 14. Job persistence operational controls

Job persistence was improved. Add operational controls before VPS use.

Tasks:

- Add a CLI or API-safe cleanup path for old persisted jobs and logs.
- Add maximum persisted log size or log truncation.
- Document job persistence environment variables in README and deployment docs.
- Add test for restoring a waiting approval job with project lock.

Done when VPS restart and job cleanup are predictable.

---

## 15. Legacy command containment

Legacy `write-guide` is marked as legacy, but it still writes `guide.md`. That can confuse users and tests.

Tasks:

- Consider writing legacy output to `guide_legacy_draft.md` instead of `guide.md`, or require an explicit legacy flag.
- If keeping old behavior, add a strong warning and make quality gates reliably block legacy guide output.
- Update README and CLI help.
- Add test confirming legacy guide cannot pass quality gates.

Done when legacy output cannot be mistaken for final guide v2.

---

## Final validation checklist

Before finishing the sprint, run:

```bash
npm run check
npm test
npm run demo:golden-route
npm run atlas -- --help
```

Manual checks:

1. Demo is idempotent.
2. Input-manifest GPX behaves like direct GPX.
3. Route segment GeoJSON exists and is readable.
4. Approval hashes are accurate after side effects.
5. Stale approvals are precise.
6. Workflow resume uses workflow state.
7. Review bundle has a clear next action.
8. Payload v2 is stable, draft-only and import-ready.

## Out of scope

Do not build frontend, 3D map, OCR, image vision, automatic publishing, payments, consumer mobile app or offline navigation in this sprint.
