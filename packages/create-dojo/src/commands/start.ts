import { Command } from "commander";
import path from "path";
import { promises as fs } from "fs";
import spawn from "cross-spawn";
import https from "https";
import { input, select } from "@inquirer/prompts";

const templates = [
  { value: "react-app", description: "React app using Dojo" },
  { value: "react-phaser-example", description: "React/Phaser app using Dojo" },
  { value: "react-pwa-app", description: "React Progressive Web Apps using Dojo" },
  { value: "react-threejs", description: "React Threejs using Dojo" },
];

async function init(projectName: string, cwd: string, template: string) {
  const projectPath = path.join(cwd, projectName);
  const clientPath = path.join(projectPath, 'client');
  const dojoStarterPath = path.join(projectPath, 'dojo-starter');

  // Create project directories
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(clientPath, { recursive: true });
  await fs.mkdir(dojoStarterPath, { recursive: true });

  // Clone template into client directory
  console.log(`Downloading ${template} into client directory...`);
  const cloneResult = spawn.sync("npx", [
    "degit",
    `dojoengine/dojo.js/clients/react/${template}`,
    clientPath,
  ], { stdio: "inherit" });

  if (cloneResult.status !== 0) {
    throw new Error(`Failed to clone template: ${template}`);
  }

  // Rewrite package.json in client directory
  await rewritePackageJson(projectName, clientPath);

  // Clone dojo-starter
  console.log(`Downloading dojo-starter...`);
  spawn.sync("npx", ["degit", `dojoengine/dojo-starter`, dojoStarterPath], { stdio: "inherit" });

  console.log(`Project initialized at ${projectPath}`);
  console.log("Congrats! Your new project has been set up successfully.\n");
  console.log(`Navigate into your project directory with:\n  cd ${projectName}\n`);
  console.log("You can then build the starter and run the client.\n");
  console.log("For detailed instructions, follow the README here:\n");
  console.log('https://book.dojoengine.org/');
}

async function rewritePackageJson(projectName: string, clientPath: string) {
  const packageJsonPath = path.join(clientPath, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
  const latestVersion = await getLatestVersion();

  packageJson.name = projectName;

  for (let dep of Object.keys(packageJson.dependencies)) {
    if (dep.startsWith("@dojoengine") && packageJson.dependencies[dep].startsWith("workspace:")) {
      packageJson.dependencies[dep] = latestVersion;
    }
  }

  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

async function getLatestVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(
      "https://registry.npmjs.org/-/package/@dojoengine/core/dist-tags",
      (res) => {
        if (res.statusCode === 200) {
          let body = "";
          res.on("data", (data) => (body += data));
          res.on("end", () => {
            resolve(JSON.parse(body).latest);
          });
        } else {
          reject(new Error(`Failed to fetch latest version: ${res.statusCode}`));
        }
      }
    ).on("error", (error) => {
      reject(error);
    });
  });
}

export const start = new Command()
  .name("start")
  .description("initialize a new project with a selected template")
  .option("-c, --cwd <cwd>", "the working directory", process.cwd())
  .action(async (options) => {
    try {
      const cwd = path.resolve(options.cwd);

      const template = await select({
        message: "Select a template",
        choices: templates,
      });

      const projectName = await input({
        message: "Project name ",
        validate: (input: string) => {
          if (/^([A-Za-z\-\_\d])+$/.test(input)) return true;
          else return "Project name may only include letters, numbers, underscores and hashes.";
        },
        default: template,
      });

      await init(projectName, cwd, template);
    } catch (error) {
      console.error("An error occurred:", error);
      process.exit(1);
    }
  });