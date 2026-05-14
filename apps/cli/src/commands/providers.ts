import { Command } from "commander";
import { getSearchProviderStatus } from "../../../../packages/atlas-research/src/index.js";

export function registerProvidersCommand(program: Command): void {
  program
    .command("providers")
    .description("Show source provider status")
    .action(() => {
      const status = getSearchProviderStatus();
      console.log(`Default provider: ${status.defaultProvider}`);
      for (const provider of status.providers) {
        const flags = [
          provider.configured ? "configured" : "not configured",
          provider.activeByDefault ? "default" : undefined
        ].filter(Boolean);
        console.log(`- ${provider.id}: ${flags.join(", ")} - ${provider.notes}`);
      }
    });
}
