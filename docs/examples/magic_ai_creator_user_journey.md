# Example: Magic AI creator user journey

## Happy path

1. Creator chooses Magic AI instead of the normal manual creator.
2. RouteMarket creates an Atlas project.
3. Creator adds GPX, notes, links and external file metadata.
4. Atlas builds the research pack and analyzes GPX.
5. Atlas pauses for review and shows a route concept plus day-by-day structure.
6. Creator approves the concept.
7. Atlas produces guide artifacts, claims, POI and payload metadata.
8. Creator approves the final guide stage.
9. Atlas exposes `importReadiness` with `canImportToRouteMarket=true`.
10. RouteMarket imports the payload into a draft.
11. Creator opens the normal editor, adjusts the draft manually and publishes by hand.

## Error cases

Atlas offline:

- Magic AI flow shows that Atlas is unavailable.
- Manual creator remains usable.

GPX missing:

- Atlas may still collect sources and write research artifacts.
- Import readiness stays blocked until navigation artifacts are strong enough.

Guide blocked:

- Atlas writes `missing_inputs.json` and blocking quality issues.
- RouteMarket keeps the import button hidden or disabled.

Imported draft manually edited:

- Re-import detects conflict.
- RouteMarket asks for explicit confirmation or creates a new draft version.

Switching back to manual flow:

- Creator leaves Magic AI flow.
- RouteMarket opens the manual editor.
- No Atlas approval is required for the manual creator.
