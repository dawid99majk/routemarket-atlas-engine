# Architecture

Atlas Engine is split into small packages so CLI, MCP, and future web/API layers share the same business logic.

## Packages

- `atlas-core`: models, validation, scoring, local storage, project creation.
- `atlas-research`: keyword expansion, provider interfaces, mock providers, source collection.
- `atlas-writer`: research brief and future guide generation.
- `atlas-mcp`: MCP server exposing Atlas workflows to Codex.
- `atlas-gis`: future routing, GPX, GeoJSON, and elevation tools.
- `atlas-gis`: GPX and GeoJSON validation now, future routing/elevation later.
- `atlas-publisher`: RouteMarket category mapping and draft payload preparation now, direct publishing later.

## Apps

- `apps/cli`: command line interface.
- `apps/api`: native HTTP API for future VPS/Lovable integration.
- `apps/web`: future dashboard.

## Integration Boundary

Atlas Engine should currently expose local files, CLI, MCP tools, and HTTP endpoints. Final RouteMarket publishing is intentionally delayed until the Lovable app is moved to VPS and the real backend shape is known.

## Storage MVP

MVP uses local files:

- `data/backlog.json` for discovered topics,
- `routes/<slug>/project.json` for project metadata,
- `routes/<slug>/sources.json` for sources,
- `routes/<slug>/brief.md` for research brief,
- `routes/<slug>/quality_report.md` for review status.
- `routes/<slug>/guide.md` for RouteMarket draft text.
- `routes/<slug>/routemarket_payload.json` for MCP/API publishing.

PostgreSQL/PostGIS can be introduced later without changing the CLI or MCP public flow.
