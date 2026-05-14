import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createAtlasApiServer } from "../apps/api/src/http.js";
import { AtlasClient, AtlasClientError } from "../packages/atlas-client/src/index.js";

let tempRoots: string[] = [];
let servers: Server[] = [];

describe("Atlas API", () => {
  afterEach(async () => {
    await Promise.all(servers.map((server) => closeServer(server)));
    servers = [];
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
    tempRoots = [];
  });

  it("runs project workflow over HTTP", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-api-"));
    tempRoots.push(rootDir);
    const server = createAtlasApiServer({ rootDir, corsOrigin: "*" });
    servers.push(server);
    await listen(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const health = await getJson(`${baseUrl}/health`);
    expect(health.ok).toBe(true);

    const created = await postJson(`${baseUrl}/projects`, {
      topic: "Albania motorcycle route 7 days",
      category: "motorcycle",
      region: "Albania",
      language: "en"
    });
    expect(created.id).toBe("albania-motorcycle-route-7-days");

    const sources = await postJson(`${baseUrl}/projects/albania-motorcycle-route-7-days/collect-sources`, {});
    expect(sources.sources.length).toBeGreaterThan(0);

    const mvp2 = await postJson(`${baseUrl}/projects/albania-motorcycle-route-7-days/run-mvp2`, {});
    expect(mvp2.project.status).toBe("ready_for_review");

    const file = await getJson(`${baseUrl}/projects/albania-motorcycle-route-7-days/files?path=guide.md`);
    expect(file.content).toContain("Route overview");
  });

  it("exposes artifacts and async jobs over the client", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-api-jobs-"));
    tempRoots.push(rootDir);
    const server = createAtlasApiServer({ rootDir, corsOrigin: "*", apiToken: "secret" });
    servers.push(server);
    await listen(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const client = new AtlasClient({ baseUrl, token: "secret" });

    const created = await client.createProject({
      topic: "Albania motorcycle route 7 days",
      category: "motorcycle",
      region: "Albania",
      language: "en"
    });
    await client.collectSources(created.id);
    const deepResearch = await client.runDeepResearch(created.id, { sourceLimit: 1 });
    expect(deepResearch.processedSourceCount).toBe(1);
    expect(deepResearch.addedClaimCount).toBeGreaterThanOrEqual(1);

    const started = await client.startRunMvp2Job(created.id);
    expect(started.job.status).toBe("queued");

    const completed = await waitForJob(client, started.job.id);
    expect(completed.job.status).toBe("completed");
    expect(completed.job.progress).toBe(100);
    expect(completed.job.logs.length).toBeGreaterThan(3);
    expect(completed.job.result.project.status).toBe("ready_for_review");

    const artifacts = await client.listProjectArtifacts(created.id);
    expect(artifacts.artifacts.some((artifact: any) => artifact.path === "guide.md" && artifact.exists)).toBe(true);
    expect(artifacts.artifacts.some((artifact: any) => artifact.path === "deep_research.json" && artifact.exists)).toBe(true);

    const jobLogs = await client.getJobLogs(started.job.id);
    expect(jobLogs.logs.some((log: any) => log.message.includes("Writing guide"))).toBe(true);

    const events = await client.listProjectEvents(created.id);
    expect(events.events.some((event: any) => event.type === "workflow.guide")).toBe(true);
    expect(events.events.some((event: any) => event.type === "project.status_changed")).toBe(true);

    const readiness = await client.getProjectReadiness(created.id);
    expect(readiness.status).toBe("ready");
    expect(readiness.blockingCount).toBe(0);

    const review = await client.getProjectReview(created.id);
    expect(review.readiness.status).toBe("ready");
    expect(review.sourceSummary.total).toBeGreaterThanOrEqual(3);
    expect(review.artifactSummary.requiredMissing).toEqual([]);

    const approved = await client.submitReviewDecision(created.id, {
      decision: "approved",
      reviewer: "Atlas QA",
      notes: "Ready for publish handoff."
    });
    expect(approved.project.status).toBe("approved_for_publish");
    expect(approved.review.decision).toBe("approved");

    const reviewedAgain = await client.getProjectReview(created.id);
    expect(reviewedAgain.latestDecision.decision).toBe("approved");
    expect(reviewedAgain.recentEvents.some((event: any) => event.type === "review.decision")).toBe(true);

    const jobs = await client.listJobs();
    expect(jobs.jobs.length).toBeGreaterThanOrEqual(1);
  });

  it("supports dashboard, categories, bundles, status updates and safe file writes", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-api-dashboard-"));
    tempRoots.push(rootDir);
    const server = createAtlasApiServer({ rootDir, corsOrigin: "*", apiToken: "secret" });
    servers.push(server);
    await listen(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const client = new AtlasClient({ baseUrl, token: "secret" });

    const categories = await client.listCategories();
    expect(categories.categories.some((category: any) => category.id === "motorcycle")).toBe(true);

    const providers = await client.listSourceProviders();
    expect(providers.providers.some((provider: any) => provider.id === "mock" && provider.configured)).toBe(true);
    expect(providers.defaultProvider).toMatch(/mock|brave/);

    const created = await client.createProject({
      topic: "Albania dashboard route",
      category: "motorcycle",
      region: "Albania",
      language: "en"
    });
    await client.writeProjectFile(created.id, "guide.md", "# Edited guide\n\nReady for internal review.\n");
    const guide = await client.readProjectFile(created.id, "guide.md");
    expect(guide.content).toContain("Edited guide");

    const updated = await client.updateProjectStatus(created.id, "ready_for_review");
    expect(updated.project.status).toBe("ready_for_review");

    const dashboard = await client.dashboard();
    expect(dashboard.totalProjects).toBe(1);
    expect(dashboard.readyForReview).toBe(1);

    const filtered = await client.listProjects({ status: "ready_for_review", category: "motorcycle", q: "dashboard" });
    expect(filtered.total).toBe(1);
    expect(filtered.projects[0].id).toBe(created.id);

    const bundle = await client.getProjectBundle(created.id);
    expect(bundle.project.id).toBe(created.id);
    expect(bundle.artifacts.some((artifact: any) => artifact.path === "guide.md" && artifact.exists)).toBe(true);
    expect(bundle.events.some((event: any) => event.type === "project.file_updated")).toBe(true);
    expect(bundle.events.some((event: any) => event.type === "project.status_changed")).toBe(true);

    const readiness = await client.getProjectReadiness(created.id);
    expect(readiness.status).toBe("blocked");
    expect(readiness.blockingCount).toBeGreaterThan(0);

    const changes = await client.submitReviewDecision(created.id, {
      decision: "changes_requested",
      notes: "Guide is too thin."
    });
    expect(changes.project.status).toBe("changes_requested");

    const blocked = await client.submitReviewDecision(created.id, {
      decision: "blocked",
      reviewer: "Atlas QA"
    });
    expect(blocked.project.status).toBe("blocked");
  });

  it("supports export, archive and job pruning", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-api-maintenance-"));
    tempRoots.push(rootDir);
    const server = createAtlasApiServer({ rootDir, corsOrigin: "*", apiToken: "secret" });
    servers.push(server);
    await listen(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const client = new AtlasClient({ baseUrl, token: "secret" });

    const created = await client.createProject({
      topic: "Export archive route",
      category: "city_walk",
      region: "Wroclaw",
      language: "en"
    });
    await client.writeProjectFile(created.id, "guide.md", "# Exported guide\n");
    const exported = await client.exportProject(created.id);
    expect(exported.project.id).toBe(created.id);
    expect(exported.artifacts.some((artifact: any) => artifact.path === "guide.md" && artifact.content.includes("Exported guide"))).toBe(true);

    const archived = await client.archiveProject(created.id, "test archive");
    expect(archived.project.status).toBe("archived");

    const started = await client.startRunMvp2Job(created.id);
    const job = await waitForJob(client, started.job.id);
    expect(job.job.status).toMatch(/completed|failed/);
    const pruned = await client.pruneJobs(0);
    expect(pruned.removed).toBeGreaterThanOrEqual(1);
  });

  it("protects private endpoints when token is configured", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-api-auth-"));
    tempRoots.push(rootDir);
    const server = createAtlasApiServer({ rootDir, corsOrigin: "*", apiToken: "secret" });
    servers.push(server);
    await listen(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const manifest = await getJson(`${baseUrl}/manifest`);
    expect(manifest.auth.enabled).toBe(true);

    const unauthorized = await fetch(`${baseUrl}/projects`);
    expect(unauthorized.status).toBe(401);

    const client = new AtlasClient({ baseUrl, token: "secret" });
    const created = await client.createProject({
      topic: "Albania motorcycle route 7 days",
      category: "motorcycle",
      region: "Albania",
      language: "en"
    });
    expect(created.id).toBe("albania-motorcycle-route-7-days");
  });

  it("returns structured client errors", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-api-client-error-"));
    tempRoots.push(rootDir);
    const server = createAtlasApiServer({ rootDir, corsOrigin: "*", apiToken: "secret" });
    servers.push(server);
    await listen(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const client = new AtlasClient({ baseUrl, token: "wrong" });

    await expect(client.listProjects()).rejects.toMatchObject({
      status: 401,
      code: "unauthorized"
    } satisfies Partial<AtlasClientError>);
  });
});

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function getJson(url: string): Promise<any> {
  const response = await fetch(url);
  expect(response.ok).toBe(true);
  return response.json();
}

async function postJson(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  expect(response.ok).toBe(true);
  return response.json();
}

async function waitForJob(client: AtlasClient, jobId: string): Promise<any> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const current = await client.getJob(jobId);
    if (["completed", "failed"].includes(current.job.status)) return current;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for job.");
}
