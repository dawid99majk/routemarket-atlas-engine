# MCP Tools

Atlas MCP should expose the same workflows as the CLI.

## MVP Tools

### discover_demand

Input:

```json
{
  "category": "motorcycle",
  "region": "Albania",
  "language": "en",
  "limit": 10
}
```

Output:

```json
{
  "topics": []
}
```

### create_route_project

Creates a local route project folder and starter files.

### collect_sources

Uses provider interfaces. MVP uses mock providers.

### generate_research_brief

Writes or returns a research brief based on project metadata and known sources.

### generate_route_concept

Writes `route_concept.md`.

### generate_guide_draft

Writes `guide.md`.

### quality_check

Writes `quality_report.md`.

### prepare_routemarket_draft

Writes `routemarket_payload.json` for use with RouteMarket MCP tools.

### generate_claims

Writes `claims.json`.

### extract_pois

Writes `poi.geojson`.

### generate_route_tips

Writes `tips.json`.

### generate_recommendations

Writes `recommendations.json`.

### prepare_media_pack

Writes `media/manifest.json` and `media/license_report.md`.

### write_review_checklist

Writes `review_checklist.md`.

## RouteMarket MCP

Available RouteMarket MCP capabilities include creating/updating route drafts, adding tips, adding POI, attaching GPX, generating and attaching images, and adding recommendations.

Atlas Publisher should default to draft status. Publishing should remain a separate human-approved step.
