# Atlas API

Native Node HTTP API for embedding Atlas Engine into the future VPS-hosted RouteMarket/Lovable application.

## Run

```bash
npm run api
```

Default URL: `http://localhost:8787`.

## Endpoints

- `GET /health`
- `GET /version`
- `POST /discover`
- `POST /projects`
- `GET /projects`
- `GET /projects/:slug`
- `POST /projects/:slug/collect-sources`
- `POST /projects/:slug/run-mvp2`
- `POST /projects/:slug/prepare-publish`
- `GET /projects/:slug/files?path=guide.md`

This API intentionally prepares local artifacts and payloads. Real production publishing can be added later after the Lovable app is moved to VPS.
