import { Command } from "commander";
import { AtlasWorkflowService, type ReviewDecision, type ApprovalDecision } from "../../../../packages/atlas-workflow/src/index.js";

const reviewDecisions = ["approved", "changes_requested", "blocked"] as const;

export function registerReviewCommand(program: Command): void {
  program
    .command("review")
    .description("Show review summary for a route project")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const service = new AtlasWorkflowService({ rootDir: process.cwd() });
      const review = await service.getReview(options.project);
      console.log(JSON.stringify({
        project: {
          id: review.project.id,
          title: review.project.title,
          status: review.project.status
        },
        readiness: {
          status: review.readiness.status,
          score: review.readiness.score,
          blockingCount: review.readiness.blockingCount,
          warningCount: review.readiness.warningCount
        },
        sourceSummary: review.sourceSummary,
        claimSummary: review.claimSummary,
        artifactSummary: review.artifactSummary,
        latestDecision: review.latestDecision ?? null
      }, null, 2));
    });
}

export function registerReviewDecisionCommand(program: Command): void {
  program
    .command("review-decision")
    .description("Save a review decision for a route project")
    .requiredOption("--project <project>", "Project slug")
    .requiredOption("--decision <decision>", "approved | changes_requested | blocked")
    .option("--reviewer <reviewer>", "Reviewer name")
    .option("--notes <notes>", "Review notes")
    .action(async (options) => {
      const service = new AtlasWorkflowService({ rootDir: process.cwd() });
      const result = await service.submitReviewDecision(options.project, {
        decision: parseReviewDecision(options.decision),
        reviewer: options.reviewer,
        notes: options.notes
      });
      console.log(JSON.stringify({
        project: {
          id: result.project.id,
          status: result.project.status,
          updatedAt: result.project.updatedAt
        },
        review: result.review
      }, null, 2));
    });
}

function parseReviewDecision(value: string): ReviewDecision {
  if (reviewDecisions.includes(value as ReviewDecision)) return value as ReviewDecision;
  throw new Error(`Unsupported review decision "${value}". Use: ${reviewDecisions.join(", ")}.`);
}

export function registerApproveCommand(program: Command): void {
  program
    .command("approve")
    .description("Approve a specific stage of the workflow")
    .requiredOption("--project <project>", "Project slug")
    .requiredOption("--stage <stage>", "Workflow stage (e.g. claims_approval, poi_approval)")
    .option("--decision <decision>", "approved | changes_requested | rejected", "approved")
    .option("--notes <notes>", "Notes")
    .action(async (options) => {
      const service = new AtlasWorkflowService({ rootDir: process.cwd() });
      await service.approveStage(options.project, options.stage, options.decision as ApprovalDecision, options.notes);
      console.log(`Approved stage ${options.stage} for project ${options.project}.`);
    });
}
