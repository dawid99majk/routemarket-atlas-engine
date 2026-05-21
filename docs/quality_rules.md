# Quality Rules

Atlas should block weak route products before they become polished-looking drafts.

## Fact Rules

1. Do not invent distance, elevation gain, season, surface, timing, difficulty or risk.
2. Use GPX coordinates or validated place names for start and end.
3. Use timestamps for duration when available; otherwise estimate by route category.
4. Surface and season require creator notes or trusted sources.
5. Factual route claims must describe the route, not that a source contains information.
6. Weak notes should create `missing_inputs.json`, not fake claims.

## GPX Rules

1. Skip invalid points safely.
2. Write `route_summary.json`.
3. Write `route_segments.json`.
4. Write `route_warnings.json`.
5. Warn about missing elevation, missing timestamps, invalid points and suspiciously short tracks.
6. GPX summary must be human-approved before publish preparation.

## Guide Rules

Final guide generation requires:

- a real route concept,
- a non-empty research pack,
- sufficient verified or likely claims,
- a valid route summary,
- GPX approval,
- guide outline approval.

The final guide must include quick facts, target audience, route value, overview, segments, POI, logistics, safety, season notes, preparation, variants, sources and disclaimer.

Do not generate a final guide from fallback text.

## Publish Gate Rules

Block `prepare-publish` when:

- blocking missing inputs exist,
- source coverage is insufficient,
- no official/map source exists,
- claims are missing or unapproved,
- GPX summary is not validated,
- route segments or warnings are missing,
- final guide approval is missing,
- guide text is too short,
- guide contains TODOs, placeholders, unknown/fallback text or generic filler,
- POI coordinates are invalid.

## Approval Side Effects

- `gpx_summary_approval` -> `route_summary.validationStatus = "validated"`.
- `claims_approval` -> reviewable creator claims become `verified`.
- `poi_approval` -> suggested POI become confirmed.
- `guide_final_approval` -> publish preparation can pass if all other gates are green.
