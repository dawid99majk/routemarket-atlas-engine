export type AtlasClientOptions = {
  baseUrl: string;
  token?: string;
};

export type DiscoverRequest = {
  category: string;
  region: string;
  language?: string;
  limit?: number;
};

export type CreateProjectRequest = {
  topic: string;
  category?: string;
  region?: string;
  language?: string;
};

export type ProjectListFilters = {
  status?: string;
  category?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type CollectSourcesOptions = {
  provider?: "auto" | "mock" | "brave";
  limit?: number;
};

export type DeepResearchOptions = {
  sourceLimit?: number;
};

export type TextInputRequest = {
  fileName: string;
  content: string;
  note?: string;
};

export type ReviewDecisionRequest = {
  decision: "approved" | "changes_requested" | "blocked";
  reviewer?: string;
  notes?: string;
};

export class AtlasClient {
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor(options: AtlasClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
  }

  health(): Promise<any> {
    return this.request("GET", "/health", undefined, false);
  }

  manifest(): Promise<any> {
    return this.request("GET", "/manifest", undefined, false);
  }

  listCategories(): Promise<any> {
    return this.request("GET", "/categories");
  }

  listSourceProviders(): Promise<any> {
    return this.request("GET", "/providers");
  }

  dashboard(): Promise<any> {
    return this.request("GET", "/dashboard");
  }

  discover(input: DiscoverRequest): Promise<any> {
    return this.request("POST", "/discover", input);
  }

  createProject(input: CreateProjectRequest): Promise<any> {
    return this.request("POST", "/projects", input);
  }

  listProjects(filters: ProjectListFilters = {}): Promise<any> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request("GET", `/projects${suffix}`);
  }

  getProject(slug: string): Promise<any> {
    return this.request("GET", `/projects/${encodeURIComponent(slug)}`);
  }

  getProjectBundle(slug: string): Promise<any> {
    return this.request("GET", `/projects/${encodeURIComponent(slug)}/bundle`);
  }

  exportProject(slug: string): Promise<any> {
    return this.request("GET", `/projects/${encodeURIComponent(slug)}/export`);
  }

  archiveProject(slug: string, reason?: string): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/archive`, { reason });
  }

  getProjectReadiness(slug: string): Promise<any> {
    return this.request("GET", `/projects/${encodeURIComponent(slug)}/readiness`);
  }

  getProjectReview(slug: string): Promise<any> {
    return this.request("GET", `/projects/${encodeURIComponent(slug)}/review`);
  }

  submitReviewDecision(slug: string, input: ReviewDecisionRequest): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/review/decision`, input);
  }

  updateProjectStatus(slug: string, status: string): Promise<any> {
    return this.request("PATCH", `/projects/${encodeURIComponent(slug)}/status`, { status });
  }

  listProjectArtifacts(slug: string): Promise<any> {
    return this.request("GET", `/projects/${encodeURIComponent(slug)}/artifacts`);
  }

  listProjectEvents(slug: string): Promise<any> {
    return this.request("GET", `/projects/${encodeURIComponent(slug)}/events`);
  }

  collectSources(slug: string, options: CollectSourcesOptions = {}): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/collect-sources`, options);
  }

  addNote(slug: string, input: TextInputRequest): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/inputs/notes`, input);
  }

  addGpx(slug: string, input: TextInputRequest): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/inputs/gpx`, input);
  }

  addLink(slug: string, input: { url: string; note?: string }): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/inputs/links`, input);
  }

  registerExternalInput(slug: string, input: {
    type: "note" | "document" | "photo" | "gpx" | "link";
    originalName: string;
    storageUrl?: string;
    storageKey?: string;
    mimeType: string;
    sizeBytes: number;
    note?: string;
  }): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/inputs/external`, input);
  }

  buildResearchPack(slug: string): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/research-pack`, {});
  }

  analyzeGpx(slug: string): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/analyze-gpx`, {});
  }

  runDeepResearch(slug: string, options: DeepResearchOptions = {}): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/deep-research`, options);
  }

  runMvp2(slug: string): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/run-mvp2`, {});
  }

  startRunMvp2Job(slug: string): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/jobs/run-mvp2`, {});
  }

  listJobs(): Promise<any> {
    return this.request("GET", "/jobs");
  }

  pruneJobs(olderThanMs?: number): Promise<any> {
    return this.request("POST", "/jobs/prune", { olderThanMs });
  }

  getJob(id: string): Promise<any> {
    return this.request("GET", `/jobs/${encodeURIComponent(id)}`);
  }

  getJobLogs(id: string): Promise<any> {
    return this.request("GET", `/jobs/${encodeURIComponent(id)}/logs`);
  }

  approveJob(id: string, approvalData: any = {}): Promise<any> {
    return this.request("POST", `/jobs/${encodeURIComponent(id)}/approve`, { approvalData });
  }

  preparePublish(slug: string): Promise<any> {
    return this.request("POST", `/projects/${encodeURIComponent(slug)}/prepare-publish`, {});
  }

  readProjectFile(slug: string, path: string): Promise<any> {
    return this.request("GET", `/projects/${encodeURIComponent(slug)}/files?path=${encodeURIComponent(path)}`);
  }

  writeProjectFile(slug: string, path: string, content: string): Promise<any> {
    return this.request("PUT", `/projects/${encodeURIComponent(slug)}/files?path=${encodeURIComponent(path)}`, { content });
  }

  private async request(method: string, path: string, body?: unknown, auth = true): Promise<any> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AtlasClientError(response.status, payload.error ?? "Atlas API request failed.", payload.code);
    }
    return payload;
  }
}

export class AtlasClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
  }
}
