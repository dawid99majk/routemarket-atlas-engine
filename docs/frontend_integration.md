# Frontend Integration Example

After the Lovable app is moved to VPS, the frontend or backend can call Atlas API through HTTP.

## Browser/Frontend Example

```ts
import { AtlasClient } from "../packages/atlas-client/src";

const atlas = new AtlasClient({
  baseUrl: "https://your-domain.example/atlas",
  token: "<internal token>"
});

await atlas.discover({
  category: "motorcycle",
  region: "Albania",
  language: "en"
});
```

## Async Workflow Example

```ts
const created = await atlas.createProject({
  topic: "Albania motorcycle route 7 days",
  category: "motorcycle",
  region: "Albania",
  language: "en"
});

await atlas.collectSources(created.id);
await atlas.runDeepResearch(created.id, { sourceLimit: 3 });
const started = await atlas.startRunMvp2Job(created.id);

let job = await atlas.getJob(started.job.id);
while (job.job.status === "queued" || job.job.status === "running") {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  job = await atlas.getJob(started.job.id);
}

const artifacts = await atlas.listProjectArtifacts(created.id);
const events = await atlas.listProjectEvents(created.id);
```

`runDeepResearch` can also be placed after MVP 2 when you want a separate enrichment pass before human review.

## Admin Dashboard Example

```ts
const dashboard = await atlas.dashboard();
const categories = await atlas.listCategories();
const bundle = await atlas.getProjectBundle("albania-motorcycle-route-7-days");
const filtered = await atlas.listProjects({
  status: "ready_for_review",
  category: "motorcycle",
  q: "albania"
});
```

## Readiness Gate Example

```ts
const readiness = await atlas.getProjectReadiness("albania-motorcycle-route-7-days");

if (readiness.status === "blocked") {
  console.log(readiness.checks.filter((check) => !check.passed));
}
```

## Review Screen Example

```ts
const review = await atlas.getProjectReview("albania-motorcycle-route-7-days");

if (review.readiness.status === "ready") {
  await atlas.submitReviewDecision("albania-motorcycle-route-7-days", {
    decision: "approved",
    reviewer: "Admin",
    notes: "Approved from the VPS admin screen."
  });
}
```

Recommended review UI fields:

- readiness status and score,
- failed blocking/warning checks,
- source count by type,
- claim count and claims needing review,
- missing required artifacts,
- latest review decision,
- recent timeline events.

## Safe Editing Example

```ts
await atlas.writeProjectFile(
  "albania-motorcycle-route-7-days",
  "guide.md",
  "# Edited guide\n\nHuman-reviewed draft."
);

await atlas.updateProjectStatus("albania-motorcycle-route-7-days", "ready_for_review");
```

## Maintenance Example

```ts
const exported = await atlas.exportProject("albania-motorcycle-route-7-days");
await atlas.archiveProject("old-route", "Duplicate topic");
await atlas.pruneJobs(60 * 60 * 1000);
```

## Progress UI

For a progress bar:

```ts
const job = await atlas.getJob(jobId);
const percent = job.job.progress;
const step = job.job.currentStep;
const logs = await atlas.getJobLogs(jobId);
```

For a project timeline:

```ts
const timeline = await atlas.listProjectEvents(projectSlug);
```

## Recommended Production Shape

For security, prefer calling Atlas API from the main app backend, not directly from public browser code. The browser calls your app backend, and your backend calls Atlas with `ATLAS_API_TOKEN`.

```txt
Browser -> Main app backend -> Atlas API
```

Direct browser calls are fine for local admin-only testing if the API is protected and not exposed publicly.
