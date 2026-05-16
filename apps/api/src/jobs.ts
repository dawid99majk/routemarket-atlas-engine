import { mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

export type JobStatus = "queued" | "running" | "waiting_for_approval" | "completed" | "failed";

export type AtlasJob<T = unknown> = {
  id: string;
  type: string;
  projectSlug?: string;
  status: JobStatus;
  progress: number;
  currentStep?: string;
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
  private readonly jobsDir: string;

  constructor(private readonly options: { maxJobs?: number; jobsDir?: string; maxPersistedLogs?: number } = {}) {
    this.jobsDir = options.jobsDir ?? join(process.cwd(), "data", "jobs");
    this.initPersistence();
  }

  private initPersistence() {
    try {
      mkdirSync(this.jobsDir, { recursive: true });
      const files = readdirSync(this.jobsDir);
      for (const file of files) {
        if (!file.endsWith(".json") || file.endsWith(".log.json")) continue;
        try {
          const content = readFileSync(join(this.jobsDir, file), "utf8");
          const job: AtlasJob = JSON.parse(content);
          if (job.status === "running" || job.status === "queued") {
            job.status = "failed";
            job.error = "process_restarted";
            job.updatedAt = new Date().toISOString();
            this.persistJob(job);
          }
          job.logs = this.readPersistedLogs(job.id);
          this.jobs.set(job.id, job);
          if (job.projectSlug && job.status === "waiting_for_approval") this.locks.set(job.projectSlug, job.id);
        } catch (e) {
          console.error(`Failed to load job from ${file}`, e);
        }
      }
    } catch (e) {
      console.error("Failed to initialize job persistence", e);
    }
  }

  private persistJob(job: AtlasJob) {
    try {
      const { logs, ...jobWithoutLogs } = job;
      writeFileSync(join(this.jobsDir, `${job.id}.json`), JSON.stringify(jobWithoutLogs, null, 2), "utf8");
    } catch (e) {
      console.error(`Failed to persist job ${job.id}`, e);
    }
  }

  private persistLog(id: string, log: AtlasJobLog) {
    try {
      appendFileSync(join(this.jobsDir, `${id}.log.jsonl`), JSON.stringify(log) + "\\n", "utf8");
      this.rotateLog(id);
    } catch (e) {
      console.error(`Failed to persist log for job ${id}`, e);
    }
  }

  private rotateLog(id: string): void {
    const max = this.options.maxPersistedLogs ?? 500;
    const path = join(this.jobsDir, `${id}.log.jsonl`);
    try {
      const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
      if (lines.length > max) writeFileSync(path, lines.slice(-max).join("\n") + "\n", "utf8");
    } catch {}
  }

  private readPersistedLogs(id: string): AtlasJobLog[] {
    try {
      const content = readFileSync(join(this.jobsDir, `${id}.log.jsonl`), "utf8");
      return content.split("\n").filter((line: string) => line.trim()).map((line: string) => JSON.parse(line));
    } catch {
      return [];
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
    this.persistJob(job);
    this.persistLog(job.id, job.logs[0]!);

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
    if (memJob.logs && memJob.logs.length > 0) return memJob.logs;
    
    try {
      const content = readFileSync(join(this.jobsDir, `${id}.log.jsonl`), "utf8");
      return content.split("\n").filter((l: string) => l.trim()).map((l: string) => JSON.parse(l));
    } catch {
      return [];
    }
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
        try {
          import("node:fs").then(fs => {
            fs.unlinkSync(join(this.jobsDir, `${job.id}.json`));
            fs.unlinkSync(join(this.jobsDir, `${job.id}.log.jsonl`));
          });
        } catch {}
      }
    }
    return { removed, remaining: this.jobs.size };
  }

  private async run<T>(job: AtlasJob<T>, task: (update: JobUpdateFn) => Promise<T>): Promise<void> {
    if (job.status !== "running" && job.status !== "queued") {
      // If resumed, it's already set to running. If new, it's queued.
    }
    
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
    this.persistLog(id, entry);
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
    this.persistJob(updated);
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
