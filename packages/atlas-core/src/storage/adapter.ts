import type { RouteProject, Source, Claim, RouteSummary } from "../index.js";

export interface ProjectStorageAdapter {
  getProject(slug: string): Promise<RouteProject>;
  saveProject(slug: string, project: RouteProject): Promise<void>;
  listProjects(): Promise<RouteProject[]>;
  
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
  
  readProjectFile(slug: string, file: string): Promise<string>;
  writeProjectFile(slug: string, file: string, content: string): Promise<void>;
  
  exists(slug: string, file: string): Promise<boolean>;
  
  // For file-based logic that still needs paths (e.g. GPX analysis)
  // In SQL implementation, this might return a virtual path or we might need to change how we handle files
  getProjectPath(slug: string): string;
}
