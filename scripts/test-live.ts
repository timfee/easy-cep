import { spawn } from "node:child_process";
import { once } from "node:events";

/**
 * Spawn a child process and stream output.
 */
async function run(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  const child = spawn(command, args, { env, stdio: "inherit" });
  const closePromise = once(child, "close");
  const errorPromise = once(child, "error");
  const result = await Promise.race([closePromise, errorPromise]);

  if (result[0] instanceof Error) {
    throw result[0];
  }

  const code = result[0] as number | null;
  if (code !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${code}`);
  }
}

/**
 * Run live E2E setup and tests.
 */
async function main() {
  await run("bun", ["x", "tsx", "scripts/e2e-setup.ts"]);
  await run("bun", ["test", "test/e2e/workflow.test.ts"], {
    ...process.env,
  });
}

if (typeof require !== "undefined" && require.main === module) {
  (async () => {
    try {
      await main();
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  })();
}
