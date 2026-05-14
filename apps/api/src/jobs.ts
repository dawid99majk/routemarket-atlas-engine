export type JobStatus = "queued" | "running" | "completed" | "failed";

export type AtlasJob<T = unknown> = {
  id: string;
  type: string;
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
};

export type JobUpdateFn = (update: JobProgressUpdate) => void;

export class JobManager {
  private readonly jobs = new Map<string, AtlasJob>();

  constructor(private readonly options: { maxJobs?: number } = {}) {}

  start<T>(type: string, task: (update: JobUpdateFn) => Promise<T>): AtlasJob<T> {
    const now = new Date().toISOString();
    const job: AtlasJob<T> = {
      id: createJobId(),
      type,
      status: "queued",
      progress: 0,
      logs: [{ at: now, message: "Job queued.", progress: 0 }],
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.id, job);
    this.enforceLimit();

    queueMicrotask(() => {
      void this.run(job, task);
    });

    return job;
  }

  get(id: string): AtlasJob | undefined {
    return this.jobs.get(id);
  }

  logs(id: string): AtlasJobLog[] {
    return this.jobs.get(id)?.logs ?? [];
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
    return { removed, remaining: this.jobs.size };
  }

  private async run<T>(job: AtlasJob<T>, task: (update: JobUpdateFn) => Promise<T>): Promise<void> {
    this.patch(job.id, {
      status: "running",
      progress: 1,
      currentStep: "running",
      startedAt: new Date().toISOString()
    });
    this.log(job.id, { message: "Job started.", progress: 1, currentStep: "running" });
    try {
      const result = await task((update) => this.log(job.id, update));
      this.patch(job.id, {
        status: "completed",
        progress: 100,
        currentStep: "completed",
        result,
        finishedAt: new Date().toISOString()
      });
      this.log(job.id, { message: "Job completed.", progress: 100, currentStep: "completed" });
    } catch (error) {
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
    this.jobs.set(id, {
      ...existing,
      progress: update.progress ?? existing.progress,
      currentStep: update.currentStep ?? existing.currentStep,
      logs: [...existing.logs, entry],
      updatedAt: entry.at
    });
  }

  private patch(id: string, patch: Partial<AtlasJob>): void {
    const existing = this.jobs.get(id);
    if (!existing) return;
    this.jobs.set(id, {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    });
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

function createJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
