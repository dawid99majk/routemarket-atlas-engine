import type { RouteProject, Source, Claim, RouteSummary } from "../index.js";
import type { InputManifest, InputItem } from "../models/input-manifest.js";

export type CreateProjectInput = {
  title: string;
  category?: string;
  region?: string;
  language?: string;
  topicId?: string;
};

export type ProjectEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  data?: Record<string, unknown>;
};

export interface ProjectRepository {
  createProject(input: CreateProjectInput): Promise<RouteProject>;
  getProject(slug: string): Promise<RouteProject>;
  saveProject(project: RouteProject): Promise<void>;
  listProjects(): Promise<RouteProject[]>;
  deleteProject(slug: string): Promise<void>;
  
  loadSources(slug: string): Promise<Source[]>;
  saveSources(slug: string, sources: Source[]): Promise<void>;
  
  loadClaims(slug: string): Promise<Claim[]>;
  saveClaims(slug: string, claims: Claim[]): Promise<void>;
  
  loadApprovals(slug: string): Promise<any>;
  saveApprovals(slug: string, approvals: any): Promise<void>;
  
  loadSummary(slug: string): Promise<RouteSummary | undefined>;
  saveSummary(slug: string, summary: RouteSummary): Promise<void>;
  
  loadWorkflowState(slug: string): Promise<any>;
  saveWorkflowState(slug: string, state: any): Promise<void>;
  
  loadMissingInputs(slug: string): Promise<any>;
  saveMissingInputs(slug: string, missing: any): Promise<void>;
  
  loadReviewDecision(slug: string): Promise<any>;
  saveReviewDecision(slug: string, decision: any): Promise<void>;
  
  loadEvents(slug: string): Promise<ProjectEvent[]>;
  saveEvents(slug: string, events: ProjectEvent[]): Promise<void>;

  loadInputManifest(slug: string): Promise<InputManifest>;
  saveInputManifest(slug: string, manifest: InputManifest): Promise<void>;
  
  readProjectFile(slug: string, file: string): Promise<string>;
  writeProjectFile(slug: string, file: string, content: string): Promise<void>;
  
  exists(slug: string, file: string): Promise<boolean>;
  
  loadArtifact(slug: string, type: string): Promise<any>;
  saveArtifact(slug: string, type: string, data: any): Promise<void>;

  getProjectPath(slug: string): string;
}
