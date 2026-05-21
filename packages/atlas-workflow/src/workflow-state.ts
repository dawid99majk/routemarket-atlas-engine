import { type RouteProject, type ProjectRepository } from "../../atlas-core/src/index.js";
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

export async function readWorkflowState(project: RouteProject, repository?: ProjectRepository): Promise<WorkflowState> {
  try {
    if (repository) {
      return await repository.loadWorkflowState(project.id);
    }
    const { readJsonFile } = await import("../../atlas-core/src/index.js");
    const { join } = await import("node:path");
    return await readJsonFile<WorkflowState>(join(project.folderPath, "workflow_state.json"));
  } catch {
    return {
      projectId: project.id,
      updatedAt: new Date().toISOString(),
      completedSteps: [],
      artifactHashes: {}
    };
  }
}

export async function writeWorkflowState(project: RouteProject, patch: Partial<WorkflowState>, repository?: ProjectRepository): Promise<WorkflowState> {
  const current = await readWorkflowState(project, repository);
  const next: WorkflowState = {
    ...current,
    ...patch,
    projectId: project.id,
    updatedAt: new Date().toISOString(),
    completedSteps: patch.completedSteps ?? current.completedSteps,
    artifactHashes: patch.artifactHashes ?? await hashImportantArtifacts(project)
  };
  
  if (repository) {
    await repository.saveWorkflowState(project.id, next);
  } else {
    const { writeJsonFile } = await import("../../atlas-core/src/index.js");
    const { join } = await import("node:path");
    await writeJsonFile(join(project.folderPath, "workflow_state.json"), next);
  }
  
  return next;
}
