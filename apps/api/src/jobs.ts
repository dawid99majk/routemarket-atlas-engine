import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type JobStatus = "queued" | "running" | "waiting_for_approval" | "completed" | "failed";

export type AtlasJob<T = unknown> = {
  id: string;
  type: string;
  projectSlug?: string;
  status: JobStatus;
  progress: number;
  currentStep?: string;
  waitingForStage?: string;
  logs: AtlasJobLog[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: T;
  error?: string;
  pendingApprovalContext?: any;
  approvalData?: any;
};

export type AtlasJobLog = {
  at: string;
  message: string;
  progress?: number;
};

export type JobProgressUpdate = {
  message: string;
  progress?: number;
  currentStep?: string;
  waitContext?: any;
};

export type JobUpdateFn = (update: JobProgressUpdate) => void;

export class JobAlreadyRunningError extends Error {
  constructor(public readonly jobId: string, slug: string) {
    super(`Active job ${jobId} already running for project ${slug}`);
    this.name = "JobAlreadyRunningError";
  }
}

export class JobManager {
  private readonly jobs = new Map<string, AtlasJob>();
  private readonly locks = new Map<string, string>();
  private readonly persistFile?: string;

  constructor(private readonly options: { maxJobs?: number; jobsDir?: string } = {}) {
    if (options.jobsDir) {
      this.persistFile = join(options.jobsDir, "jobs_persistence.json");
      this.initPersistence(options.jobsDir);
    }
  }

  private initPersistence(dir: string) {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    } catch {}

    if (!this.persistFile) return;

    try {
      if (existsSync(this.persistFile)) {
        const content = readFileSync(this.persistFile, "utf8");
        const persistedJobs: AtlasJob[] = JSON.parse(content);
        for (const job of persistedJobs) {
          if (job.status === "running" || job.status === "queued") {
            job.status = "failed";
            job.error = "process_restarted";
            job.updatedAt = new Date().toISOString();
          }
          job.logs = []; // logs remain exclusively in RAM
          this.jobs.set(job.id, job);
          
          // Only maintain locks for jobs that are still valid blocks (waiting for approval)
          // Finished or failed (including restarted) jobs should not hold locks.
          if (job.projectSlug && job.status === "waiting_for_approval") {
            this.locks.set(job.projectSlug, job.id);
          }
        }
        // Save back immediately to mark active jobs as failed
        this.persistState();
      }
    } catch (e) {
      console.error("Failed to load jobs persistence from " + this.persistFile, e);
    }
  }

  private persistState() {
    if (!this.persistFile) return;
    try {
      const activeAndWaiting = Array.from(this.jobs.values())
        .filter(j => j.status === "queued" || j.status === "running" || j.status === "waiting_for_approval")
        .map(job => {
          const { logs, ...jobWithoutLogs } = job;
          return jobWithoutLogs;
        });
      writeFileSync(this.persistFile, JSON.stringify(activeAndWaiting, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to persist jobs state", e);
    }
  }

  start<T>(type: string, task: (update: JobUpdateFn) => Promise<T>, projectSlug?: string): AtlasJob<T> {
    if (projectSlug) {
      const activeJobId = this.locks.get(projectSlug);
      if (activeJobId) {
        const activeJob = this.jobs.get(activeJobId);
        if (activeJob && (activeJob.status === "running" || activeJob.status === "queued" || activeJob.status === "waiting_for_approval")) {
          throw new JobAlreadyRunningError(activeJob.id, projectSlug);
        }
      }
    }

    const now = new Date().toISOString();
    const job: AtlasJob<T> = {
      id: createJobId(),
      type,
      projectSlug,
      status: "queued",
      progress: 0,
      logs: [{ at: now, message: "Job queued.", progress: 0 }],
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.id, job);
    this.persistState();

    if (projectSlug) {
      this.locks.set(projectSlug, job.id);
    }
    this.enforceLimit();

    queueMicrotask(() => {
      void this.run(job, task);
    });

    return job;
  }

  resume<T>(id: string, approvalData: any, task: (update: JobUpdateFn) => Promise<T>): void {
    const job = this.jobs.get(id);
    if (!job || job.status !== "waiting_for_approval") {
      throw new Error(`Job ${id} cannot be resumed (status: ${job?.status})`);
    }

    this.patch(id, {
      status: "running",
      approvalData,
      pendingApprovalContext: undefined,
      waitingForStage: undefined,
      updatedAt: new Date().toISOString()
    });
    this.log(id, { message: "Job resumed after approval.", progress: job.progress });

    queueMicrotask(() => {
      void this.run(this.jobs.get(id)!, task);
    });
  }

  get(id: string): AtlasJob | undefined {
    return this.jobs.get(id);
  }

  logs(id: string): AtlasJobLog[] {
    const memJob = this.jobs.get(id);
    if (!memJob) return [];
    return memJob.logs || [];
  }

  list(): AtlasJob[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  prune(options: { olderThanMs?: number; statuses?: JobStatus[] } = {}): { removed: number; remaining: number } {
    const now = Date.now();
    let removed = 0;
    const statuses = options.statuses ?? ["completed", "failed"];
    for (const job of this.jobs.values()) {
      const ageMs = now - new Date(job.updatedAt).getTime();
      if (statuses.includes(job.status) && (options.olderThanMs === undefined || ageMs > options.olderThanMs)) {
        this.jobs.delete(job.id);
        removed += 1;
      }
    }
    this.persistState();
    return { removed, remaining: this.jobs.size };
  }

  private async run<T>(job: AtlasJob<T>, task: (update: JobUpdateFn) => Promise<T>): Promise<void> {
    this.patch(job.id, {
      status: "running",
      startedAt: job.startedAt ?? new Date().toISOString()
    });

    try {
      const result = await task((update) => {
        if (update.waitContext) {
          this.patch(job.id, {
            status: "waiting_for_approval",
            pendingApprovalContext: update.waitContext,
            waitingForStage: update.waitContext.stage,
            progress: update.progress ?? job.progress,
            currentStep: update.currentStep ?? job.currentStep
          });
          this.log(job.id, {
            message: `Job paused: ${update.message}`,
            progress: update.progress,
            currentStep: update.currentStep
          });
          throw new JobPausedInterrupt();
        }
        this.log(job.id, update);
      });

      this.patch(job.id, {
        status: "completed",
        progress: 100,
        currentStep: "completed",
        result,
        finishedAt: new Date().toISOString()
      });
      this.log(job.id, { message: "Job completed.", progress: 100, currentStep: "completed" });
    } catch (error) {
      if (error instanceof JobPausedInterrupt) {
        return;
      }

      this.patch(job.id, {
        status: "failed",
        currentStep: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        finishedAt: new Date().toISOString()
      });
      this.log(job.id, { message: error instanceof Error ? error.message : "Job failed.", currentStep: "failed" });
    }
  }

  private log(id: string, update: JobProgressUpdate): void {
    const existing = this.jobs.get(id);
    if (!existing) return;
    const entry: AtlasJobLog = {
      at: new Date().toISOString(),
      message: update.message,
      progress: update.progress
    };
    const updated = {
      ...existing,
      progress: update.progress ?? existing.progress,
      currentStep: update.currentStep ?? existing.currentStep,
      logs: existing.logs ? [...existing.logs, entry] : [entry],
      updatedAt: entry.at
    };
    this.jobs.set(id, updated);
  }

  private patch(id: string, patch: Partial<AtlasJob>): void {
    const existing = this.jobs.get(id);
    if (!existing) return;
    const updated = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.jobs.set(id, updated);
    this.persistState();
  }

  private enforceLimit(): void {
    const maxJobs = this.options.maxJobs ?? 200;
    if (this.jobs.size <= maxJobs) return;
    const removable = this.list()
      .reverse()
      .filter((job) => job.status === "completed" || job.status === "failed");
    for (const job of removable) {
      if (this.jobs.size <= maxJobs) return;
      this.jobs.delete(job.id);
    }
    this.persistState();
  }
}

class JobPausedInterrupt extends Error {
  constructor() {
    super("Job paused for approval");
    this.name = "JobPausedInterrupt";
  }
}

function createJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
