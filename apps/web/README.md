# Atlas Web

The first reviewer interface is served directly by Atlas API at `GET /reviewer`.

It is intentionally dependency-free for the VPS deployment: the page loads projects, project review bundles, readiness issues, approvals, recent events, and can trigger stage approval, workflow runs, review decisions, and publish preparation through the existing Atlas API.

Private API calls still require `ATLAS_API_TOKEN`; the page stores the token only in the browser local storage of the reviewer machine.
