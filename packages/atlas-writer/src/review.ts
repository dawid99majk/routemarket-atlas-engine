import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RouteProject } from "../../atlas-core/src/index.js";

export async function writeReviewChecklist(project: RouteProject): Promise<string> {
  const checklist = `# Review Checklist

## Research

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

  await writeFile(join(project.folderPath, "review_checklist.md"), checklist, "utf8");
  return checklist;
}
