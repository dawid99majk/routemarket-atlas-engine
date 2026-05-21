# Deployment Notes

Atlas Engine can run as a side service next to the RouteMarket/Lovable application on a VPS.

## Option A: Docker Compose

Use:

```txt
deploy/docker-compose.example.yml
```

Recommended binding:

```txt
127.0.0.1:8787:8787
```

This keeps Atlas private to the VPS unless a reverse proxy explicitly exposes it.

## Option B: systemd

Use:

```txt
deploy/atlas-api.service.example
```

Typical install path:

```txt
/srv/routemarket-atlas-engine
```

## Production Environment

Start from:

```txt
deploy/production.env.example
```

Important values:

- `ATLAS_ROOT_DIR`
- `ATLAS_API_PORT`
- `ATLAS_CORS_ORIGIN`
- `ATLAS_API_TOKEN`
- `ATLAS_LOG_REQUESTS`
- `ATLAS_MAX_JOBS`
- `GEMINI_API_KEY` when Google Search grounding and Gemini deep research should be enabled

## Security Recommendation

Do not expose Atlas API publicly at first. Prefer:

```txt
Main app backend -> localhost Atlas API
```

The public frontend should call your main app backend, and the backend should call Atlas using `ATLAS_API_TOKEN`.
