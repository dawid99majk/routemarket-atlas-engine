# VPS Integration Plan

The current direction is to move the Lovable-built application to a private VPS and embed Atlas Engine into that environment.

For now, Atlas Engine should expose a stable internal API and local workflow artifacts. Direct production publishing can wait until the VPS app structure is known.

## Recommended Shape

```txt
VPS
  routemarket-app/
    frontend from Lovable
    backend/application server
  routemarket-atlas-engine/
    Atlas API
    data/
    routes/
```

The Lovable app can call Atlas API over localhost or an internal private network:

```txt
Lovable app -> Atlas API -> local route files / future adapters
```

## Atlas API Role

Atlas API should:

- discover route topics,
- create local route projects,
- collect sources,
- run deep research enrichment on selected sources,
- run the MVP 2 workflow,
- expose project status and generated files,
- expose review bundles and save human review decisions,
- prepare RouteMarket payloads.

Atlas API should not yet:

- publish directly without review,
- assume the final RouteMarket database/API shape,
- require external API keys for the MVP flow.

## Deployment Notes

Use environment variables:

```txt
ATLAS_ROOT_DIR=/srv/routemarket-atlas-engine
ATLAS_API_PORT=8787
ATLAS_CORS_ORIGIN=https://your-app-domain.example
ATLAS_API_TOKEN=<long random internal token>
GEMINI_API_KEY=<optional Google/Gemini search and research key>
```

On the VPS, the app can run Atlas as a separate process managed by systemd, PM2, Docker, or the same process manager as the main app.

Deployment examples are available in:

- `Dockerfile`
- `deploy/docker-compose.example.yml`
- `deploy/atlas-api.service.example`
- `deploy/production.env.example`

The API contract is documented in `docs/api_contract.md`.

## Later Integration

After the Lovable app is moved:

1. inspect the real backend/database structure,
2. decide whether Atlas writes to RouteMarket through MCP, direct DB, or internal HTTP API,
3. expand Google/Gemini grounded search and Maps enrichment,
4. add authentication between the app and Atlas API,
5. add a human review screen in the app using `GET /projects/:slug/review`,
6. only then enable publish actions.
