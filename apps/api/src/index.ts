import { startAtlasApi } from "./http.js";
import { FileProjectRepository, PostgresProjectRepository } from "../../../packages/atlas-core/src/index.js";

const port = Number(process.env.PORT ?? process.env.ATLAS_API_PORT ?? 8787);
const rootDir = process.env.ATLAS_ROOT_DIR ?? process.cwd();
const corsOrigin = process.env.ATLAS_CORS_ORIGIN ?? "*";
const apiToken = process.env.ATLAS_API_TOKEN || undefined;
const logRequests = process.env.ATLAS_LOG_REQUESTS === "true";
const maxJobs = Number(process.env.ATLAS_MAX_JOBS ?? 200);
const jobsDir = process.env.ATLAS_JOBS_DIR;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const repository = (supabaseUrl && supabaseKey)
  ? new PostgresProjectRepository(supabaseUrl, supabaseKey)
  : new FileProjectRepository(rootDir);

const server = startAtlasApi({ rootDir, port, corsOrigin, apiToken, logRequests, maxJobs, jobsDir, repository });

if (process.env.NODE_ENV === "production") {
  if (!apiToken) {
    console.error("FATAL: ATLAS_API_TOKEN is required in production environment.");
    process.exit(1);
  }
  if (corsOrigin === "*") {
    console.error("FATAL: ATLAS_CORS_ORIGIN='*' is forbidden in production environment.");
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      console.log(`Atlas API stopped after ${signal}.`);
      process.exit(0);
    });
  });
}
