#!/usr/bin/env node
import { Command } from "commander";
import { registerCollectSourcesCommand } from "./commands/collect-sources.js";
import { registerCreateProjectCommand } from "./commands/create-project.js";
import { registerDiscoverCommand } from "./commands/discover.js";
import { registerWriteBriefCommand } from "./commands/write-brief.js";
import { registerWriteConceptCommand } from "./commands/write-concept.js";
import { registerWriteGuideCommand } from "./commands/write-guide.js";
import { registerQualityCheckCommand } from "./commands/quality-check.js";
import { registerValidateGpxCommand } from "./commands/validate-gpx.js";
import { registerPreparePublishCommand } from "./commands/prepare-publish.js";
import { registerGenerateClaimsCommand } from "./commands/generate-claims.js";
import { registerExtractPoisCommand } from "./commands/extract-pois.js";
import { registerGenerateTipsCommand } from "./commands/generate-tips.js";
import { registerGenerateRecommendationsCommand } from "./commands/generate-recommendations.js";
import { registerPrepareMediaCommand } from "./commands/prepare-media.js";
import { registerWriteReviewCommand } from "./commands/write-review.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerRunMvp2Command } from "./commands/run-mvp2.js";
import { registerProvidersCommand } from "./commands/providers.js";
import { registerReviewCommand, registerReviewDecisionCommand, registerApproveCommand } from "./commands/review.js";
import { registerDeepResearchCommand } from "./commands/deep-research.js";
import { registerInputCommands } from "./commands/input.js";
import { registerBuildResearchPackCommand } from "./commands/build-research-pack.js";
import { registerAnalyzeGpxCommand } from "./commands/analyze-gpx.js";
import { registerGenerateGpxCommand } from "./commands/generate-gpx.js";

const program = new Command();

program
  .name("atlas")
  .description("RouteMarket Atlas Engine CLI")
  .version("0.1.0");

registerDiscoverCommand(program);
registerCreateProjectCommand(program);
registerCollectSourcesCommand(program);
registerWriteBriefCommand(program);
registerWriteConceptCommand(program);
registerWriteGuideCommand(program);
registerQualityCheckCommand(program);
registerValidateGpxCommand(program);
registerPreparePublishCommand(program);
registerGenerateClaimsCommand(program);
registerExtractPoisCommand(program);
registerGenerateTipsCommand(program);
registerGenerateRecommendationsCommand(program);
registerPrepareMediaCommand(program);
registerWriteReviewCommand(program);
registerStatusCommand(program);
registerRunMvp2Command(program);
registerProvidersCommand(program);
registerReviewCommand(program);
registerReviewDecisionCommand(program);
registerApproveCommand(program);
registerDeepResearchCommand(program);
registerInputCommands(program);
registerBuildResearchPackCommand(program);
registerAnalyzeGpxCommand(program);
registerGenerateGpxCommand(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
