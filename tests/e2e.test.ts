import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AtlasWorkflowService } from "../packages/atlas-workflow/src/index.js";
import { ProjectAlreadyExistsError } from "../packages/atlas-core/src/index.js";
import { QualityGateError } from "../packages/atlas-workflow/src/index.js";

describe("Atlas Workflow E2E", () => {
  let rootDir: string;
  let service: AtlasWorkflowService;

  beforeAll(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "atlas-test-"));
    service = new AtlasWorkflowService({ rootDir });
  });

  afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it("should prevent creating duplicate projects", async () => {
    await service.createProject({ topic: "Duplicate Test", region: "Unknown" });
    await expect(service.createProject({ topic: "Duplicate Test", region: "Unknown" }))
      .rejects.toThrow(ProjectAlreadyExistsError);
  });

  it("should run full MVP2 workflow and fail quality gates", async () => {
    const project = await service.createProject({ topic: "Norway Roadtrip", region: "Norway" });
    const slug = project.slug;

    await service.collectSources(slug, { provider: "mock", limit: 3 });

    await service.runMvp2(slug);

    const readiness = await service.assessReadiness(slug);
    expect(readiness.blockingCount).toBeGreaterThanOrEqual(0);

    await expect(service.preparePublish(slug))
      .rejects.toThrow(QualityGateError);

    const review = await service.getReview(slug);
    expect(["blocked", "changes_requested"]).toContain(review.recommendedDecision);

    const updated = await service.setProjectStatus(slug, "approved_for_publish");
    expect(updated.status).toBe("approved_for_publish");
  });
});
