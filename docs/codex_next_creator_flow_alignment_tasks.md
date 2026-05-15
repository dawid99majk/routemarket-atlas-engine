# Codex Next Tasks: Creator Flow Alignment

## Main concern

Do not mix two different product flows:

1. Normal RouteMarket creator.
2. Magic AI / Atlas assisted creator.

The normal creator is the existing manual route creation flow. It must stay simple, predictable and independent from Atlas.

Magic AI / Atlas is an optional assisted mode. It helps create a draft from rough inputs such as notes, GPX, links and later documents/photos. It does not replace the normal creator.

The shared destination is only the RouteMarket draft. The path to create that draft is different.

## Product rule

Manual creator is the reliable default.

Magic AI / Atlas is a power tool.

Both may create or update a draft, but only a human creator publishes.

Atlas must never silently publish and must never silently overwrite a manually edited draft.

## Flow A: normal manual creator

Purpose: creator already knows the route and wants to add it manually.

Behavior:

- Opens the existing manual route creator.
- User uploads GPX, photos and fills route fields manually.
- No Atlas project is created automatically.
- No Atlas approvals are required.
- No Magic AI pipeline is required.
- The route can be saved as draft and published through the existing manual validation flow.
- This flow must work even when Atlas API is offline or not configured.

Do not modify this flow unless a task explicitly says so.

## Flow B: Magic AI / Atlas creator

Purpose: creator has rough materials and wants AI to prepare a structured draft.

Behavior:

- Opens a separate Magic AI / Atlas flow.
- Creates an Atlas project.
- Accepts notes, GPX, links and later external files.
- Builds research pack.
- Analyzes GPX.
- Extracts claims and POI.
- Pauses for human approval stages.
- Generates guide only when inputs are strong enough.
- Prepares a RouteMarket draft payload.
- Imports that payload into RouteMarket as a draft only.
- User can then open the normal editor and manually adjust the draft.
- Publishing remains a separate human action.

## Required documentation tasks

Create these documents before frontend integration starts:

1. `docs/adr/creator_flow_separation.md`
2. `docs/magic_ai_atlas_integration_contract.md`
3. `docs/examples/magic_ai_creator_user_journey.md`

The ADR must explain:

- why manual creator and Magic AI creator are separate,
- what each flow owns,
- what each flow must not do,
- how Atlas output becomes a RouteMarket draft,
- why publishing is never automatic.

The integration contract must define:

- user journey,
- Atlas project lifecycle,
- RouteMarket draft lifecycle,
- payload import rules,
- approval rules,
- failure states,
- UI states,
- security assumptions,
- manual creator independence.

The example journey must show:

- creator chooses Magic AI,
- creator adds GPX and notes,
- Atlas generates research and guide artifacts,
- creator approves stages,
- Atlas prepares payload,
- creator imports payload to draft,
- creator edits draft in normal editor,
- creator publishes manually.

Also describe error cases: Atlas offline, GPX missing, blocked guide, imported draft edited manually, and switching back to manual flow.

## Creation source metadata

Payload v2 and future RouteMarket draft import must distinguish creation source.

Use these values:

- `manual`
- `atlas_ai`
- `manual_with_ai_suggestions`

Atlas payload should include:

- creation source set to `atlas_ai`,
- Atlas project slug,
- payload id,
- contract version,
- generated at,
- draft-only mode,
- AI assisted flag.

Manual creator should be treated as `manual` and must not require Atlas metadata.

## Import safety rules

Atlas import into RouteMarket must be safe and idempotent.

Rules:

- first import creates a draft,
- re-import updates the existing Atlas draft only if it was not manually edited after last import,
- if draft was manually edited, require explicit confirmation or create a new draft version,
- import never changes status to published,
- import should preserve manually added media and user edits unless overwrite is explicit,
- import should store source artifact hashes.

## Magic AI UI states

Define these future UI states in docs:

- not started,
- collecting inputs,
- ready to run Atlas,
- running,
- waiting for approval,
- changes requested,
- blocked by missing inputs,
- ready to import,
- imported to draft,
- import conflict,
- failed.

For each state define:

- what user sees,
- primary action,
- secondary action,
- backend artifact or endpoint powering it,
- what is not allowed.

## Payload to draft mapping

Add a mapping table in docs from Atlas payload to RouteMarket draft fields.

Include:

- title,
- description,
- full guide,
- category,
- location,
- distance,
- elevation,
- estimated time,
- difficulty,
- risk level,
- loop type,
- surface type,
- season,
- start and end point,
- tags,
- POI,
- tips,
- recommendations,
- media manifest,
- GPX reference,
- route segment reference,
- claims summary,
- quality gate result.

For each field define whether it is required, optional, imported once, updated on re-import, or protected after manual edit.

## Atlas import readiness

Expose or document an import readiness object containing:

- can import to RouteMarket,
- blocking reasons,
- warnings,
- missing approvals,
- stale approvals,
- payload path,
- recommended next action.

The frontend should show the import button only when this object says import is safe.

## Tests and guards

Add tests or contract checks proving:

- Atlas payload is always draft-only,
- Atlas payload marks creation source as Atlas AI,
- manual route creation does not require Atlas,
- prepare publish never returns live publish action,
- import contract includes conflict-safe fields,
- legacy guide cannot pass as final Atlas guide.

## Future implementation order

Do not start RouteMarket frontend integration yet.

First implement:

1. creator flow separation docs,
2. Magic AI integration contract,
3. creation source fields in payload v2,
4. import readiness object,
5. client aliases with product names,
6. payload to draft mapping tests.

Only then integrate with the RouteMarket app.

## Final rule for Codex

If unsure whether to modify manual creator or Atlas flow, leave manual creator untouched and modify only Atlas/Magic AI flow.
