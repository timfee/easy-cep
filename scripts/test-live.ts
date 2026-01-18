import { spawn } from "node:child_process";

/**
 * Spawn a child process and stream output.
 */
function run(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

/**
 * Run live E2E setup and tests.
 */
async function main() {
  await run("bun", ["x", "tsx", "scripts/e2e-setup.ts"]);
  await run("bun", ["test", "test/e2e/workflow.test.ts"], {
    ...process.env,
    RUN_E2E: "1",
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
