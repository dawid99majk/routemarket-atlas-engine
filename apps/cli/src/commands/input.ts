import { Command } from "commander";
import { loadProject } from "./load-project.js";
import { 
  loadInputManifest, 
  addInputLink, 
  addInputFile 
} from "../../../../packages/atlas-core/src/index.js";

export function registerInputCommands(program: Command) {
  program
    .command("input-list")
    .description("List all input materials for a project")
    .requiredOption("-p, --project <slug>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const manifest = await loadInputManifest(project.folderPath);
      
      console.log(`\nInput materials for project: ${project.title}`);
      console.log(`Updated at: ${manifest.updatedAt}`);
      console.log("-".repeat(50));
      
      if (manifest.items.length === 0) {
        console.log("No input materials added yet.");
      } else {
        manifest.items.forEach(item => {
          console.log(`[${item.type.toUpperCase()}] ${item.originalName} (${item.status})`);
          if (item.notes) console.log(`  Note: ${item.notes}`);
        });
      }
      console.log("");
    });

  program
    .command("input-add-link")
    .description("Add a link to the project")
    .requiredOption("-p, --project <slug>", "Project slug")
    .requiredOption("-u, --url <url>", "Link URL")
    .option("-n, --note <note>", "Optional note")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const item = await addInputLink(project.folderPath, options.url, options.note);
      console.log(`Added link: ${item.path}`);
    });

  program
    .command("input-add-note")
    .description("Add a note file to the project")
    .requiredOption("-p, --project <slug>", "Project slug")
    .requiredOption("-f, --file <path>", "Path to the note file")
    .option("-n, --note <note>", "Optional note")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const item = await addInputFile(project.folderPath, options.file, "note", options.note);
      console.log(`Added note: ${item.path}`);
    });

  program
    .command("input-add-gpx")
    .description("Add a GPX file to the project")
    .requiredOption("-p, --project <slug>", "Project slug")
    .requiredOption("-f, --file <path>", "Path to the GPX file")
    .option("-n, --note <note>", "Optional note")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const item = await addInputFile(project.folderPath, options.file, "gpx", options.note);
      console.log(`Added GPX: ${item.path}`);
    });

  program
    .command("input-add-photo")
    .description("Add a photo file to the project")
    .requiredOption("-p, --project <slug>", "Project slug")
    .requiredOption("-f, --file <path>", "Path to the photo file")
    .option("-n, --note <note>", "Optional note")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const item = await addInputFile(project.folderPath, options.file, "photo", options.note);
      console.log(`Added photo: ${item.path}`);
    });
}
