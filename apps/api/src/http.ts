import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { AtlasWorkflowService } from "../../../packages/atlas-workflow/src/index.js";
import { badRequest, HttpError, notFound, unauthorized } from "./errors.js";
import { JobManager } from "./jobs.js";
import {
  CreateProjectBodySchema,
  DiscoverBodySchema,
  EmptyBodySchema,
  AddGpxBodySchema,
  AddLinkBodySchema,
  AddNoteBodySchema,
  RegisterExternalInputBodySchema,
  ArchiveProjectBodySchema,
  CollectSourcesBodySchema,
  DeepResearchBodySchema,
  JobApprovalBodySchema,
  PruneJobsBodySchema,
  SubmitReviewDecisionBodySchema,
  UpdateProjectStatusBodySchema,
  WriteProjectFileBodySchema
} from "./schemas.js";

export type AtlasApiOptions = {
  rootDir: string;
  port?: number;
  corsOrigin?: string;
  apiToken?: string;
  logRequests?: boolean;
  maxJobs?: number;
  maxPersistedLogs?: number;
};

type RouteParams = Record<string, string>;
type HandlerContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: RouteParams;
  service: AtlasWorkflowService;
  jobs: JobManager;
  corsOrigin: string;
  apiToken?: string;
};

type Handler = (context: HandlerContext) => Promise<unknown>;

type Route = {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
  public?: boolean;
};

export function createAtlasApiServer(options: AtlasApiOptions): Server {
  const service = new AtlasWorkflowService({ rootDir: options.rootDir });
  const jobs = new JobManager({ maxJobs: options.maxJobs, maxPersistedLogs: options.maxPersistedLogs });
  const corsOrigin = options.corsOrigin ?? "*";
  const apiToken = options.apiToken;
  const logRequests = options.logRequests ?? false;
  const routes = createRoutes();

  return createServer(async (req, res) => {
    const startedAt = Date.now();
    setCorsHeaders(res, corsOrigin, req.headers.origin as string | undefined);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    const matchedRoute = matchRoute(routes, req.method ?? "GET", url.pathname);
    if (!matchedRoute) {
      sendError(res, notFound("Endpoint not found."));
      return;
    }

    try {
      if (apiToken && !matchedRoute.public) assertAuthorized(req, apiToken);
      const result = await matchedRoute.handler({
        req,
        res,
        url,
        params: matchedRoute.params,
        service,
        jobs,
        corsOrigin,
        apiToken
      });
      if (!res.writableEnded) sendJson(res, 200, result);
    } catch (error) {
      sendError(res, error);
    } finally {
      if (logRequests) {
        console.log(`${req.method ?? "GET"} ${url.pathname} ${res.statusCode} ${Date.now() - startedAt}ms`);
      }
    }
  });
}

export function startAtlasApi(options: AtlasApiOptions): Server {
  const server = createAtlasApiServer(options);
  const port = options.port ?? 8787;
  server.listen(port, () => {
    console.log(`Atlas API listening on http://localhost:${port}`);
  });
  return server;
}

function createRoutes(): Route[] {
  return [
    route("GET", "/health", async () => ({ ok: true }), { public: true }),
    route("GET", "/version", async () => ({ name: "routemarket-atlas-engine", version: "0.1.0" }), { public: true }),
    route("GET", "/manifest", async ({ apiToken }) => apiManifest(Boolean(apiToken)), { public: true }),
    route("GET", "/categories", async ({ service }) => ({ categories: service.listCategories() })),
    route("GET", "/providers", async ({ service }) => service.listSourceProviders()),
    route("GET", "/dashboard", async ({ service }) => service.dashboard()),
    route("POST", "/discover", async ({ req, service }) => service.discover(DiscoverBodySchema.parse(await readJson(req)))),
    route("POST", "/projects", async ({ req, service }) => service.createProject(CreateProjectBodySchema.parse(await readJson(req)))),
    route("GET", "/projects", async ({ service, url }) => service.listProjects(projectFiltersFromUrl(url))),
    route("GET", "/projects/:slug", async ({ params, service }) => ({ project: await service.getProject(params.slug) })),
    route("GET", "/projects/:slug/bundle", async ({ params, service }) => service.getProjectBundle(params.slug)),
    route("GET", "/projects/:slug/export", async ({ params, service }) => service.exportProject(params.slug)),
    route("POST", "/projects/:slug/archive", async ({ req, params, service }) => {
      const body = ArchiveProjectBodySchema.parse(await readJson(req));
      return { project: await service.archiveProject(params.slug, body.reason) };
    }),
    route("GET", "/projects/:slug/readiness", async ({ params, service }) => service.assessReadiness(params.slug)),
    route("GET", "/projects/:slug/review", async ({ params, service }) => service.getReview(params.slug)),
    route("POST", "/projects/:slug/review/decision", async ({ req, params, service }) => {
      const body = SubmitReviewDecisionBodySchema.parse(await readJson(req));
      return service.submitReviewDecision(params.slug, body);
    }),
    route("PATCH", "/projects/:slug/status", async ({ req, params, service }) => {
      const body = UpdateProjectStatusBodySchema.parse(await readJson(req));
      return { project: await service.setProjectStatus(params.slug, body.status) };
    }),
    route("GET", "/projects/:slug/artifacts", async ({ params, service }) => service.listArtifacts(params.slug)),
    route("GET", "/projects/:slug/events", async ({ params, service }) => service.listEvents(params.slug)),
    route("POST", "/projects/:slug/collect-sources", async ({ req, params, service }) => {
      const body = CollectSourcesBodySchema.parse(await readJson(req));
      return { sources: await service.collectSources(params.slug, body) };
    }),
    route("POST", "/projects/:slug/inputs/notes", async ({ req, params, service }) => {
      const body = AddNoteBodySchema.parse(await readJson(req));
      return service.addNoteText(params.slug, body);
    }),
    route("POST", "/projects/:slug/inputs/gpx", async ({ req, params, service }) => {
      const body = AddGpxBodySchema.parse(await readJson(req));
      return service.addGpxText(params.slug, body);
    }),
    route("POST", "/projects/:slug/inputs/links", async ({ req, params, service }) => {
      const body = AddLinkBodySchema.parse(await readJson(req));
      return service.addLink(params.slug, body);
    }),
    route("POST", "/projects/:slug/inputs/external", async ({ req, params, service }) => {
      const body = RegisterExternalInputBodySchema.parse(await readJson(req));
      return service.registerExternalInput(params.slug, body);
    }),
    route("POST", "/projects/:slug/research-pack", async ({ req, params, service }) => {
      EmptyBodySchema.parse(await readJson(req));
      return service.buildResearchPack(params.slug);
    }),
    route("POST", "/projects/:slug/analyze-gpx", async ({ req, params, service }) => {
      EmptyBodySchema.parse(await readJson(req));
      return service.analyzeGpx(params.slug);
    }),
    route("POST", "/projects/:slug/deep-research", async ({ req, params, service }) => {
      const body = DeepResearchBodySchema.parse(await readJson(req));
      return service.runDeepResearch(params.slug, body);
    }),
    route("POST", "/projects/:slug/run-mvp2", async ({ req, params, service }) => {
      EmptyBodySchema.parse(await readJson(req));
      return service.runMvp2(params.slug);
    }),
    route("POST", "/projects/:slug/jobs/run-mvp2", async ({ req, params, service, jobs }) => {
      EmptyBodySchema.parse(await readJson(req));
      return { job: jobs.start(`run-mvp2:${params.slug}`, (update) => service.runMvp2WithProgress(params.slug, update), params.slug) };
    }),
    route("GET", "/jobs", async ({ jobs }) => ({ jobs: jobs.list() })),
    route("GET", "/jobs/pending-approvals", async ({ jobs }) => ({
      jobs: jobs.list().filter(j => j.status === "waiting_for_approval")
    })),
    route("POST", "/jobs/:id/approve", async ({ req, params, jobs, service }) => {
      const body = JobApprovalBodySchema.parse(await readJson(req));
      const job = jobs.get(params.id);
      if (!job) throw notFound("Job not found.");
      if (job.status !== "waiting_for_approval") throw badRequest("Job is not waiting for approval.");

      // Resume logic
      const projectSlug = job.type.split(":")[1];
      if (!projectSlug) throw badRequest("Invalid job type for approval.");

      // Next step logic: we need to know what the next step is.
      // For simplicity, we assume we resume runMvp2. 
      // In a real system, we'd store the next step in the job context.
      const nextStepMap: Record<string, string> = {
        "gpx_summary_approval": "claims",
        "claims_approval": "pois",
        "poi_approval": "concept",
        "concept_approval": "guide_outline",
        "guide_outline_approval": "guide",
        "guide_final_approval": "finalize"
      };
      const stage = job.currentStep ?? "";
      await service.approveStage(projectSlug, stage, "approved", "Approved through job resume endpoint.");
      const nextStep = nextStepMap[stage] ?? "input";

      jobs.resume(params.id, body.approvalData, (update) => 
        service.runMvp2WithProgress(projectSlug, update, nextStep)
      );

      return { message: "Job resumed.", jobId: params.id, nextStep };
    }),
    route("GET", "/projects/:slug/missing-inputs", async ({ params, service }) => {
      try {
        return JSON.parse(await service.readProjectFile(params.slug, "missing_inputs.json"));
      } catch {
        return { missing: [] };
      }
    }),
    route("POST", "/jobs/prune", async ({ req, jobs }) => {
      const body = PruneJobsBodySchema.parse(await readJson(req));
      return jobs.prune({ olderThanMs: body.olderThanMs });
    }),
    route("GET", "/jobs/:id", async ({ params, jobs }) => {
      const job = jobs.get(params.id);
      if (!job) throw notFound("Job not found.");
      return { job };
    }),
    route("GET", "/jobs/:id/logs", async ({ params, jobs }) => {
      const job = jobs.get(params.id);
      if (!job) throw notFound("Job not found.");
      return { jobId: params.id, logs: jobs.logs(params.id) };
    }),
    route("POST", "/projects/:slug/prepare-publish", async ({ req, params, service }) => {
      EmptyBodySchema.parse(await readJson(req));
      return service.preparePublish(params.slug);
    }),
    route("GET", "/projects/:slug/files", async ({ params, service, url }) => {
      const file = url.searchParams.get("path");
      if (!file) throw badRequest("Missing path query parameter.");
      return { path: file, content: await service.readProjectFile(params.slug, file) };
    }),
    route("PUT", "/projects/:slug/files", async ({ req, params, service, url }) => {
      const file = url.searchParams.get("path");
      if (!file) throw badRequest("Missing path query parameter.");
      const body = WriteProjectFileBodySchema.parse(await readJson(req));
      return service.writeProjectFile(params.slug, file, body.content);
    })
  ];
}

function route(method: string, template: string, handler: Handler, options: { public?: boolean } = {}): Route {
  const keys: string[] = [];
  const pattern = new RegExp(`^${template.replace(/:([^/]+)/g, (_, key: string) => {
    keys.push(key);
    return "([^/]+)";
  })}$`);
  return { method, pattern, keys, handler, public: options.public };
}

function matchRoute(routes: Route[], method: string, pathname: string): (Route & { params: RouteParams }) | undefined {
  for (const routeDef of routes) {
    if (routeDef.method !== method) continue;
    const match = routeDef.pattern.exec(pathname);
    if (!match) continue;
    const params = Object.fromEntries(routeDef.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
    return { ...routeDef, params };
  }
  return undefined;
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    throw badRequest("Invalid JSON body.");
  }
}

function setCorsHeaders(res: ServerResponse, corsOrigin: string, reqOrigin?: string): void {
  if (corsOrigin === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    const allowed = corsOrigin.split(",").map((s) => s.trim());
    if (reqOrigin && allowed.includes(reqOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", reqOrigin);
      res.setHeader("Vary", "Origin");
    }
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Atlas-API-Token");
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(body, null, 2)}\n`);
}

import { ZodError } from "zod";
import { QualityGateError } from "../../../packages/atlas-workflow/src/index.js";

function sendError(res: ServerResponse, error: unknown): void {
  if (error instanceof ZodError) {
    sendJson(res, 400, {
      error: "Validation failed.",
      code: "validation_error",
      details: error.issues
    });
    return;
  }
  if (error && typeof error === "object" && "name" in error && error.name === "JobAlreadyRunningError") {
    sendJson(res, 409, {
      error: (error as Error).message,
      code: "job_conflict"
    });
    return;
  }
  if (error && typeof error === "object" && "name" in error && error.name === "ProjectAlreadyExistsError") {
    sendJson(res, 409, {
      error: (error as Error).message,
      code: "conflict"
    });
    return;
  }
  if (error && typeof error === "object" && "name" in error && error.name === "QualityGateError") {
    sendJson(res, 422, {
      error: (error as QualityGateError).message,
      code: "quality_gate_failed",
      details: (error as QualityGateError).issues
    });
    return;
  }
  if (error instanceof HttpError) {
    sendJson(res, error.statusCode, { error: error.message, code: error.code });
    return;
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.startsWith("Invalid filename") || message.startsWith("Invalid file extension") || message.includes("too large")) {
    sendJson(res, 400, { error: message, code: "bad_request" });
    return;
  }
  sendJson(res, 500, { error: message, code: "internal_error" });
}

function assertAuthorized(req: IncomingMessage, apiToken: string): void {
  const auth = req.headers.authorization;
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : undefined;
  const headerToken = req.headers["x-atlas-api-token"];
  const token = bearer ?? (Array.isArray(headerToken) ? headerToken[0] : headerToken);
  if (token !== apiToken) throw unauthorized();
}

function apiManifest(authEnabled: boolean) {
  return {
    name: "routemarket-atlas-engine",
    version: "0.1.0",
    auth: {
      enabled: authEnabled,
      header: "Authorization: Bearer <ATLAS_API_TOKEN>"
    },
    endpoints: [
      "GET /health",
      "GET /version",
      "GET /manifest",
      "GET /categories",
      "GET /providers",
      "GET /dashboard",
      "POST /discover",
      "POST /projects",
      "GET /projects",
      "GET /projects/:slug",
      "GET /projects/:slug/bundle",
      "GET /projects/:slug/export",
      "POST /projects/:slug/archive",
      "GET /projects/:slug/readiness",
      "GET /projects/:slug/review",
      "POST /projects/:slug/review/decision",
      "PATCH /projects/:slug/status",
      "GET /projects/:slug/artifacts",
      "GET /projects/:slug/events",
      "POST /projects/:slug/collect-sources",
      "POST /projects/:slug/inputs/notes",
      "POST /projects/:slug/inputs/gpx",
      "POST /projects/:slug/inputs/links",
      "POST /projects/:slug/inputs/external",
      "POST /projects/:slug/research-pack",
      "POST /projects/:slug/analyze-gpx",
      "POST /projects/:slug/deep-research",
      "POST /projects/:slug/run-mvp2",
      "POST /projects/:slug/jobs/run-mvp2",
      "GET /jobs",
      "POST /jobs/prune",
      "GET /jobs/:id",
      "GET /jobs/:id/logs",
      "POST /projects/:slug/prepare-publish",
      "GET /projects/:slug/files?path=guide.md",
      "PUT /projects/:slug/files?path=guide.md"
    ]
  };
}

function projectFiltersFromUrl(url: URL) {
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");
  return {
    status: url.searchParams.get("status") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined
  };
}
