# Codex Next Tasks After Merge

## Context

The Atlas Engine main branch now contains the creator-grade pipeline: input handling, research packs, GPX analysis, approvals, guide v2, missing input reports, readiness checks and the golden route demo.

The next sprint should focus on production hardening. Do not add 3D maps, mobile offline features or RouteMarket frontend integration yet. The goal is a stricter backend that refuses weak route guides instead of producing polished but unreliable output.

## 1. Baseline check

Run the full project validation first: install dependencies, run TypeScript check, run tests, run the golden route demo and verify CLI help.

Fix any failing checks before making feature changes.

## 2. Documentation refresh

Update README and the API contract. The current README still describes the older MVP flow and does not properly document the new creator-grade pipeline.

Document input folders, research packs, GPX analysis, approvals, guide v2, missing input reports, quality gates, the golden route demo and the current API flow.

Done when a new developer can understand and run the project from the README alone.

## 3. Remove default auto approval

The normal workflow must not auto-approve production steps. Auto approval should only exist as an explicit demo or development mode.

Default workflow execution should pause at missing approvals. Production mode should reject or ignore auto approval.

Done when normal workflow pauses for approval, while the golden route demo still has an explicit demo path.

## 4. GPX analyzer hardening

Improve GPX analysis so it does not invent route facts.

Do not set season or surface type unless input data supports it. Use coordinates or validated names for start and end. Estimate time based on route category, and use timestamps if available. Generate route segment data and route warnings. Warnings should cover missing elevation, missing timestamps, invalid points and suspiciously short tracks.

The analyzer should tolerate common GPX variants and skip invalid points safely.

Done when GPX analysis produces route summary, elevation profile, route segments and route warnings, with tests for at least motorcycle and hiking estimates.

## 5. Guide v2 hardening

Final guide generation should require a real route concept and sufficient verified route facts. Remove weak fallback text. If the concept, claims, research pack or GPX approval are missing, write a blocking missing input report and do not write the final guide.

Expand the final guide structure to include quick facts, target audience, route value, route overview, segment description, POI, logistics, safety, season notes, preparation, variants, sources and disclaimer.

Done when final guide is not generated from weak inputs and tests confirm this behavior.

## 6. Approval side effects

Approval decisions should update artifacts, not only write logs.

GPX approval should mark route summary as validated. Claims approval should upgrade eligible claim statuses. POI approval should mark valid candidates as approved. Final guide approval should be required by publish checks.

Done when tests confirm that approvals modify related artifacts.

## 7. Claim engine guardrails

Claims must be factual statements about the route. They must not describe that a source contains information.

Add guards against meta-claims. Extract simple factual claims from creator notes using sentence splitting and route-related keywords. If no real facts are found, write a missing input report instead of creating fake claims.

Done when weak notes do not generate fake claims and useful notes generate factual route claims.

## 8. Quality gates v2

Strengthen quality gates so weak projects cannot reach publish preparation.

Block publish when missing inputs are blocking, GPX-derived segment or warning artifacts are missing, final guide approval is missing, claims approval is missing, GPX summary is not validated, or the payload description is missing or too short.

Also block final guides containing obvious fallback text such as unknown values, todo markers or generic safety filler.

Done when publish preparation returns clear quality issues for weak projects.

## 9. API input endpoints

Add API support for future creator UI handoff. The frontend should be able to create a project, send text notes, send GPX text, add links, build the research pack and trigger GPX analysis without direct filesystem access.

Start with JSON payloads for notes and GPX text. Binary upload can remain out of scope for now.

Add filename sanitization, extension checks, request size limits and tests for invalid filenames.

Done when a client can run the basic creator input flow through HTTP.

## 10. Job persistence

Pending approval jobs should survive API restart on a VPS.

Add optional file-based job persistence. Persist job status and pending approval state. Logs may remain in memory for now.

Done when a waiting approval job survives restart when persistence is enabled.

## 11. MCP alignment

MCP tools should expose the current creator-grade flow: create project, add note, add GPX text, build research pack, analyze GPX, run workflow, get review, approve stage, read project file and prepare publish.

Done when an agent can run the creator-grade flow through MCP without using CLI.

## 12. Golden route smoke test

Make the golden route demo a regression test.

The smoke test should verify that key artifacts exist after the demo and that the generated guide does not contain weak fallback text.

Done when tests catch weak guide regressions.

## 13. Git hygiene

Generated route outputs should not be committed. Keep fixtures in the fixtures folder only. Running the demo should not leave a large git diff.

Done when demo output is ignored or cleaned and git status stays clean after intentional changes.

## Final checklist

Before finishing, run the full validation again: TypeScript check, tests, golden route demo and CLI help.

Manual checks should confirm that project creation works, API health works, normal workflow pauses for approvals, approval validates GPX summary, guide generation blocks weak input, quality gates block fallback content, and publish preparation only succeeds after approvals and valid guide.

## Out of scope

Do not implement 3D maps, mobile offline app, RouteMarket frontend integration, binary upload, OCR, photo vision, automatic publishing, payments or consumer app features in this sprint.

The expected outcome is a stricter and more honest Atlas Engine ready to become the backend of RouteMarket Route Factory.
