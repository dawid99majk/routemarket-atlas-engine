import { Command } from "commander";
import { updateProjectStatus } from "../../../../packages/atlas-core/src/index.js";
import { prepareRouteMarketDraft } from "../../../../packages/atlas-publisher/src/index.js";
import { generateClaims, extractPois } from "../../../../packages/atlas-research/src/index.js";
import {
  generateGuideDraft,
  generateQualityReport,
  generateRecommendations,
  generateRouteConcept,
  generateRouteTips,
  prepareMediaPack,
  writeReviewChecklist
} from "../../../../packages/atlas-writer/src/index.js";
import { loadProject, loadProjectSources } from "./load-project.js";

export function registerRunMvp2Command(program: Command): void {
  program
    .command("run-mvp2")
    .description("Run MVP 2 local pipeline for an existing project")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      let project = await loadProject(process.cwd(), options.project);
      const sources = await loadProjectSources(project);
      await generateClaims(project, sources);
      await extractPois(project);
      const concept = await generateRouteConcept({ project, sources });
      await generateGuideDraft({ project, sources, concept });
      await generateRouteTips(project);
      await generateRecommendations(project);
      await prepareMediaPack(project);
      await generateQualityReport({ project, sources, gpxValid: false, geojsonValid: true });
      await writeReviewChecklist(project);
      await prepareRouteMarketDraft(project);
      project = await updateProjectStatus(project, "ready_for_review");
      console.log(`MVP 2 pipeline complete for ${project.id}. Status: ${project.status}`);
    });
}
