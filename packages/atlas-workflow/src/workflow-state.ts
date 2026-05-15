import { readJsonFile, writeJsonFile, type RouteProject } from "../../atlas-core/src/index.js";
import { join } from "node:path";
import { hashImportantArtifacts } from "./artifact-hashes.js";

export type WorkflowState = {
  projectId: string;
  updatedAt: string;
  currentStep?: string;
  nextStep?: string;
  waitingApprovalStage?: string;
  completedSteps: string[];
  artifactHashes: Record<string, string>;
};

export async function readWorkflowState(project: RouteProject): Promise<WorkflowState> {
  try {
    return await readJsonFile<WorkflowState>(path(project));
  } catch {
    return {
      projectId: project.id,
      updatedAt: new Date().toISOString(),
      completedSteps: [],
      artifactHashes: {}
    };
  }
}

export async function writeWorkflowState(project: RouteProject, patch: Partial<WorkflowState>): Promise<WorkflowState> {
  const current = await readWorkflowState(project);
  const next: WorkflowState = {
    ...current,
    ...patch,
    projectId: project.id,
    updatedAt: new Date().toISOString(),
    completedSteps: patch.completedSteps ?? current.completedSteps,
    artifactHashes: patch.artifactHashes ?? await hashImportantArtifacts(project)
  };
  await writeJsonFile(path(project), next);
  return next;
}

function path(project: RouteProject): string {
  return join(project.folderPath, "workflow_state.json");
}
