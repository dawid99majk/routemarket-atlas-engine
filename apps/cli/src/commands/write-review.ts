import { Command } from "commander";
import { writeReviewChecklist } from "../../../../packages/atlas-writer/src/index.js";
import { loadProject } from "./load-project.js";

export function registerWriteReviewCommand(program: Command): void {
  program
    .command("write-review")
    .description("Write review_checklist.md")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const checklist = await writeReviewChecklist(project);
      console.log(`Wrote review checklist for ${project.id} (${checklist.length} characters)`);
    });
}
