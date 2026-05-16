import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  createRouteProject,
  readJsonFile,
  routesPath,
  type RouteProject,
  type Source
} from "../../../atlas-core/src/index.js";
import { validateGeoJsonFile, validateGpxFile } from "../../../atlas-gis/src/index.js";
import { prepareRouteMarketDraft } from "../../../atlas-publisher/src/index.js";
import { analyzeGpx, buildResearchPack, collectSources, discoverDemand, extractPois, generateClaims } from "../../../atlas-research/src/index.js";
import { AtlasWorkflowService } from "../../../atlas-workflow/src/index.js";
import {
  generateGuideDraft,
  generateRecommendations,
  generateQualityReport,
  generateResearchBrief,
  generateRouteConcept,
  generateRouteTips,
  prepareMediaPack,
  writeReviewChecklist
} from "../../../atlas-writer/src/index.js";

export function registerAtlasTools(server: McpServer): void {
  server.registerTool(
    "discover_demand",
    {
      description: "Discover high-potential route topics and write data/backlog.json.",
      inputSchema: {
        rootDir: z.string().optional(),
        category: z.string(),
        region: z.string(),
        language: z.string().default("en"),
        limit: z.number().int().positive().max(50).default(10)
      }
    },
    async (input) => {
      const topics = await discoverDemand({
        rootDir: input.rootDir ?? process.cwd(),
        category: input.category,
        region: input.region,
        language: input.language,
        limit: input.limit
      });
      return jsonToolResult({ topics });
    }
  );

  server.registerTool(
    "create_route_project",
    {
      description: "Create a local Atlas route project folder with starter files.",
      inputSchema: {
        rootDir: z.string().optional(),
        topic: z.string(),
        category: z.string().optional(),
        region: z.string().optional(),
        language: z.string().default("en")
      }
    },
    async (input) => {
      const project = await createRouteProject({
        rootDir: input.rootDir ?? process.cwd(),
        title: input.topic,
        category: input.category,
        region: input.region,
        language: input.language
      });
      return jsonToolResult({ project });
    }
  );

  server.registerTool(
    "collect_sources",
    {
      description: "Collect sources for an existing route project using MVP mock providers.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string(),
        limit: z.number().int().positive().max(50).default(20)
      }
    },
    async (input) => {
      const rootDir = input.rootDir ?? process.cwd();
      const routeProject = await readJsonFile<RouteProject>(join(routesPath(rootDir, input.project), "project.json"));
      const sources = await collectSources({ project: routeProject, limit: input.limit });
      return jsonToolResult({ project: routeProject.id, sources });
    }
  );

  server.registerTool(
    "add_note",
    {
      description: "Add creator note text to an existing route project input manifest.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string(),
        fileName: z.string(),
        content: z.string(),
        note: z.string().optional()
      }
    },
    async (input) => {
      const service = new AtlasWorkflowService({ rootDir: input.rootDir ?? process.cwd() });
      return jsonToolResult(await service.addNoteText(input.project, input));
    }
  );

  server.registerTool(
    "add_gpx_text",
    {
      description: "Add GPX XML text to an existing route project input manifest.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string(),
        fileName: z.string(),
        content: z.string(),
        note: z.string().optional()
      }
    },
    async (input) => {
      const service = new AtlasWorkflowService({ rootDir: input.rootDir ?? process.cwd() });
      return jsonToolResult(await service.addGpxText(input.project, input));
    }
  );

  server.registerTool(
    "add_link",
    {
      description: "Add a creator/source link to an existing route project input manifest.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string(),
        url: z.string(),
        note: z.string().optional()
      }
    },
    async (input) => {
      const service = new AtlasWorkflowService({ rootDir: input.rootDir ?? process.cwd() });
      return jsonToolResult(await service.addLink(input.project, { url: input.url, note: input.note }));
    }
  );

  server.registerTool(
    "register_external_input",
    {
      description: "Register an externally stored input file by URL or storage key without fetching it.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string(),
        type: z.enum(["note", "document", "photo", "gpx", "link"]),
        originalName: z.string(),
        storageUrl: z.string().optional(),
        storageKey: z.string().optional(),
        mimeType: z.string(),
        sizeBytes: z.number().int().nonnegative(),
        note: z.string().optional()
      }
    },
    async (input) => {
      const service = new AtlasWorkflowService({ rootDir: input.rootDir ?? process.cwd() });
      return jsonToolResult(await service.registerExternalInput(input.project, input as any));
    }
  );

  server.registerTool(
    "build_research_pack",
    {
      description: "Build research_pack.json from creator inputs, links, collected sources and deep research.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const rootDir = input.rootDir ?? process.cwd();
      const routeProject = await readJsonFile<RouteProject>(join(routesPath(rootDir, input.project), "project.json"));
      const researchPack = await buildResearchPack(routeProject);
      return jsonToolResult({ project: routeProject.id, researchPack });
    }
  );

  server.registerTool(
    "analyze_gpx",
    {
      description: "Analyze project GPX input and write route_summary.json, route_segments.json and route_warnings.json.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const rootDir = input.rootDir ?? process.cwd();
      const routeProject = await readJsonFile<RouteProject>(join(routesPath(rootDir, input.project), "project.json"));
      const routeSummary = await analyzeGpx(routeProject);
      return jsonToolResult({ project: routeProject.id, routeSummary });
    }
  );

  server.registerTool(
    "run_workflow",
    {
      description: "Run the creator-grade workflow. It pauses at required approvals by default.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const service = new AtlasWorkflowService({ rootDir: input.rootDir ?? process.cwd() });
      return jsonToolResult(await service.runMvp2WithProgress(input.project));
    }
  );

  server.registerTool(
    "get_review",
    {
      description: "Read the current project review bundle, readiness, quality issues and latest decision.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const service = new AtlasWorkflowService({ rootDir: input.rootDir ?? process.cwd() });
      return jsonToolResult(await service.getReview(input.project));
    }
  );

  server.registerTool(
    "approve_stage",
    {
      description: "Approve, reject, or request changes for a workflow stage and apply approval side effects.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string(),
        stage: z.string(),
        decision: z.enum(["approved", "changes_requested", "rejected"]).default("approved"),
        notes: z.string().optional()
      }
    },
    async (input) => {
      const service = new AtlasWorkflowService({ rootDir: input.rootDir ?? process.cwd() });
      await service.approveStage(input.project, input.stage, input.decision as any, input.notes);
      return jsonToolResult({ project: input.project, stage: input.stage, decision: input.decision });
    }
  );

  server.registerTool(
    "read_project_file",
    {
      description: "Read a safe known artifact from a route project.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string(),
        file: z.string()
      }
    },
    async (input) => {
      const service = new AtlasWorkflowService({ rootDir: input.rootDir ?? process.cwd() });
      return jsonToolResult({ path: input.file, content: await service.readProjectFile(input.project, input.file) });
    }
  );

  server.registerTool(
    "generate_research_brief",
    {
      description: "Generate a research brief for an existing route project.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const rootDir = input.rootDir ?? process.cwd();
      const projectFolder = routesPath(rootDir, input.project);
      const routeProject = await readJsonFile<RouteProject>(join(projectFolder, "project.json"));
      const sources = await readJsonFile<Source[]>(join(projectFolder, "sources.json"));
      const brief = await generateResearchBrief({ project: routeProject, sources });
      return jsonToolResult({ project: routeProject.id, brief });
    }
  );

  server.registerTool(
    "generate_route_concept",
    {
      description: "Generate route_concept.md for an existing route project.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const { routeProject, sources } = await loadProjectBundle(input.rootDir, input.project);
      const concept = await generateRouteConcept({ project: routeProject, sources });
      return jsonToolResult({ project: routeProject.id, concept });
    }
  );

  server.registerTool(
    "generate_guide_draft",
    {
      description: "Generate guide.md for an existing route project.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const { routeProject, sources } = await loadProjectBundle(input.rootDir, input.project);
      const guide = await generateGuideDraft({ project: routeProject, sources });
      return jsonToolResult({ project: routeProject.id, guide });
    }
  );

  server.registerTool(
    "quality_check",
    {
      description: "Generate quality_report.md for an existing route project.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const { rootDir, routeProject, sources } = await loadProjectBundle(input.rootDir, input.project);
      const gpx = await validateGpxFile(join(routesPath(rootDir, input.project), "route.gpx")).catch(() => ({ valid: false }));
      const geojson = await validateGeoJsonFile(join(routesPath(rootDir, input.project), "route.geojson")).catch(() => ({ valid: false }));
      const report = await generateQualityReport({
        project: routeProject,
        sources,
        gpxValid: gpx.valid,
        geojsonValid: geojson.valid
      });
      return jsonToolResult({ project: routeProject.id, report });
    }
  );

  server.registerTool(
    "prepare_routemarket_draft",
    {
      description: "Build routemarket_payload.json for RouteMarket MCP publishing.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const { routeProject } = await loadProjectBundle(input.rootDir, input.project);
      const prepared = await prepareRouteMarketDraft(routeProject);
      return jsonToolResult(prepared);
    }
  );

  server.registerTool(
    "generate_claims",
    {
      description: "Generate claims.json from collected sources.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const { routeProject } = await loadProjectBundle(input.rootDir, input.project);
      const claims = await generateClaims(routeProject);
      return jsonToolResult({ project: routeProject.id, claims });
    }
  );

  server.registerTool(
    "extract_pois",
    {
      description: "Generate poi.geojson with MVP candidate POI.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const { routeProject } = await loadProjectBundle(input.rootDir, input.project);
      const pois = await extractPois(routeProject);
      return jsonToolResult({ project: routeProject.id, pois });
    }
  );

  server.registerTool(
    "generate_route_tips",
    {
      description: "Generate tips.json for RouteMarket wizard tips.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const { routeProject } = await loadProjectBundle(input.rootDir, input.project);
      const tips = await generateRouteTips(routeProject);
      return jsonToolResult({ project: routeProject.id, tips });
    }
  );

  server.registerTool(
    "generate_recommendations",
    {
      description: "Generate recommendations.json placeholders.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const { routeProject } = await loadProjectBundle(input.rootDir, input.project);
      const recommendations = await generateRecommendations(routeProject);
      return jsonToolResult({ project: routeProject.id, recommendations });
    }
  );

  server.registerTool(
    "prepare_media_pack",
    {
      description: "Prepare media manifest and license report.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const { routeProject } = await loadProjectBundle(input.rootDir, input.project);
      const manifest = await prepareMediaPack(routeProject);
      return jsonToolResult({ project: routeProject.id, manifest });
    }
  );

  server.registerTool(
    "write_review_checklist",
    {
      description: "Write review_checklist.md.",
      inputSchema: {
        rootDir: z.string().optional(),
        project: z.string()
      }
    },
    async (input) => {
      const { routeProject } = await loadProjectBundle(input.rootDir, input.project);
      const checklist = await writeReviewChecklist(routeProject);
      return jsonToolResult({ project: routeProject.id, checklist });
    }
  );
}

function jsonToolResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

async function loadProjectBundle(rootDirInput: string | undefined, project: string) {
  const rootDir = rootDirInput ?? process.cwd();
  const projectFolder = routesPath(rootDir, project);
  const routeProject = await readJsonFile<RouteProject>(join(projectFolder, "project.json"));
  const sources = await readJsonFile<Source[]>(join(projectFolder, "sources.json"));
  return { rootDir, projectFolder, routeProject, sources };
}
