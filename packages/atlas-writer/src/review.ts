import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RouteProject, ProjectRepository } from "../../atlas-core/src/index.js";

export async function writeReviewChecklist(project: RouteProject, repository?: ProjectRepository): Promise<string> {
  const { checkQualityGates } = await import("../../atlas-workflow/src/quality-gates.js");
  const issues = await checkQualityGates(project);
  
  let header = "# Review Checklist\n\n";
  
  if (issues.length > 0) {
    header += "## ❌ PUBLISH BLOCKED\n\n";
    header += "The following quality gates failed:\n\n";
    for (const issue of issues) {
      header += `- [ ] **${issue.rule}**: ${issue.message}\n`;
    }
    header += "\n---\n\n";
  } else {
    header += "## ✅ QUALITY GATES PASSED\n\nReady for final review.\n\n---\n\n";
  }

  const checklist = `${header}## Research

- [ ] At least 3 useful sources collected
- [ ] Official/local source checked
- [ ] Important claims are not single-source

## Route

- [ ] Route concept reviewed
- [ ] POI coordinates checked
- [ ] Distance and timing validated
- [ ] GPX validated

## Safety

- [ ] Weather/season note checked
- [ ] Category-specific risks checked
- [ ] Emergency/logistics fallback considered

## RouteMarket

- [ ] Guide reviewed
- [ ] Tips reviewed
- [ ] Recommendations reviewed
- [ ] Media/license report checked
- [ ] RouteMarket payload prepared
- [ ] Human approved before publish
`;

  if (repository) {
    await repository.writeProjectFile(project.id, "review_checklist.md", checklist);
  } else {
    await writeFile(join(project.folderPath, "review_checklist.md"), checklist, "utf8");
  }
  return checklist;
}
