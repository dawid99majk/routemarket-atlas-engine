import { describe, it, expect, afterEach } from "vitest";
import { JobManager } from "../apps/api/src/jobs.js";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Job Manager Persistence", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("persists and restores waiting_for_approval jobs across restarts", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "atlas-persistence-test-"));
    const jobsDir = join(tempDir, "jobs");

    // 1. Initialize Job Manager and start a job that pauses
    const firstManager = new JobManager({ jobsDir });
    const started = firstManager.start("test-job", async (update) => {
      update({
        message: "Need approval",
        progress: 50,
        currentStep: "step1",
        waitContext: { stage: "approval1" }
      });
      return { success: true };
    }, "test-project");

    // Wait for the job to pause
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    const jobBefore = firstManager.get(started.id);
    expect(jobBefore?.status).toBe("waiting_for_approval");
    expect(jobBefore?.waitingForStage).toBe("approval1");
    expect(jobBefore?.projectSlug).toBe("test-project");

    // 2. Simulate "restart" by creating a new Job Manager pointing to the same dir
    const secondManager = new JobManager({ jobsDir });
    const jobAfter = secondManager.get(started.id);

    expect(jobAfter).toBeDefined();
    expect(jobAfter?.status).toBe("waiting_for_approval");
    expect(jobAfter?.waitingForStage).toBe("approval1");
    expect(jobAfter?.projectSlug).toBe("test-project");
    expect(jobAfter?.id).toBe(started.id);

    // 3. Verify that we can resume the restored job
    let resumedResult: any = null;
    secondManager.resume(started.id, { approved: true }, async () => {
      resumedResult = { success: true, from: "resumed" };
      return resumedResult;
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(resumedResult).toEqual({ success: true, from: "resumed" });
    expect(secondManager.get(started.id)?.status).toBe("completed");
  });

  it("marks running jobs as failed with process_restarted error after restart", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "atlas-persistence-fail-test-"));
    const jobsDir = join(tempDir, "jobs");

    const firstManager = new JobManager({ jobsDir });
    const started = firstManager.start("test-job-fail", async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { ok: true };
    }, "fail-project");

    // Wait a bit for it to start running
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(firstManager.get(started.id)?.status).toBe("running");

    // Simulate restart
    const secondManager = new JobManager({ jobsDir });
    const jobAfter = secondManager.get(started.id);

    expect(jobAfter?.status).toBe("failed");
    expect(jobAfter?.error).toBe("process_restarted");
  });
});
