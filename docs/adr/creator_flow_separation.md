# ADR: creator flow separation

## Status

Accepted.

## Decision

RouteMarket keeps two separate creator flows:

1. Manual creator.
2. Magic AI / Atlas assisted creator.

They share only one destination: a RouteMarket draft.

They do not share the creation path.

## Why the flows are separate

The manual creator is the reliable default. It must stay simple, predictable and usable even when Atlas is offline, disabled or not configured.

Magic AI / Atlas is a power tool. It accepts rough materials, pauses for approvals and prepares a draft payload. That flow is slower, stateful and approval-driven by design. Mixing both flows would make the normal creator harder to trust.

## What each flow owns

Manual creator owns:

- manual GPX upload,
- manual field editing,
- manual save as draft,
- manual publish through RouteMarket validation,
- manual edits after Atlas import.

Magic AI / Atlas owns:

- project creation inside Atlas,
- creator materials ingestion,
- research pack generation,
- GPX analysis,
- claims, POI and guide generation,
- approval checkpoints,
- RouteMarket draft payload preparation,
- import readiness reporting.

## What each flow must not do

Manual creator must not:

- require Atlas configuration,
- create Atlas projects implicitly,
- require Atlas approvals,
- fail just because Atlas is offline.

Magic AI / Atlas must not:

- silently publish,
- silently overwrite a manually edited draft,
- bypass human approvals,
- replace the normal editor as the final publishing surface.

## How Atlas output becomes a RouteMarket draft

1. Atlas creates a reviewed payload in `routemarket_payload.json`.
2. The payload is always draft-only.
3. The payload carries `creationSource=atlas_ai`, `payloadId`, `atlasProjectSlug`, `generatedAt`, artifact hashes and import readiness.
4. RouteMarket imports the payload into a draft.
5. A human creator opens the normal RouteMarket editor, reviews the draft and publishes manually.

## Publishing rule

Publishing is never automatic because RouteMarket is the human-owned legal and editorial boundary. Atlas may prepare, score and warn, but only a human creator may publish.
