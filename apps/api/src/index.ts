import { startAtlasApi } from "./http.js";

const port = Number(process.env.ATLAS_API_PORT ?? 8787);
const rootDir = process.env.ATLAS_ROOT_DIR ?? process.cwd();
const corsOrigin = process.env.ATLAS_CORS_ORIGIN ?? "*";
const apiToken = process.env.ATLAS_API_TOKEN || undefined;
const logRequests = process.env.ATLAS_LOG_REQUESTS === "true";
const maxJobs = Number(process.env.ATLAS_MAX_JOBS ?? 200);

const server = startAtlasApi({ rootDir, port, corsOrigin, apiToken, logRequests, maxJobs });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      console.log(`Atlas API stopped after ${signal}.`);
      process.exit(0);
    });
  });
}
