import { Command } from "commander";
import { AtlasWorkflowService } from "../../../../packages/atlas-workflow/src/index.js";

export function registerRunMvp2Command(program: Command): void {
  program
    .command("run-mvp2")
    .description("Run MVP 2 local pipeline for an existing project")
    .requiredOption("--project <project>", "Project slug")
    .option("--step <step>", "Step to start/resume from")
    .action(async (options) => {
      const service = new AtlasWorkflowService({ rootDir: process.cwd() });
      const result = await service.runMvp2WithProgress(
        options.project, 
        (progress) => {
          console.log(`[${progress.currentStep}] ${progress.message} (${progress.progress}%)`);
        },
        options.step
      );

      if (result.status === "paused") {
        console.log(`\nWorkflow PAUSED at step: ${result.step}`);
        console.log(`Please approve the stage to continue.`);
        console.log(`Command: npm run atlas -- approve --project ${options.project} --stage <stage>`);
      } else {
        console.log(`\nMVP 2 pipeline COMPLETED for ${options.project}.`);
      }
    });
}
