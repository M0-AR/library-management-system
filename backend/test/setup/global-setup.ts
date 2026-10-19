import { execFileSync } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { runBootstrap } from "../../src/scripts/bootstrap";

const CONTAINER = "lms-pg-test";

function docker(args: string[]): string {
  return execFileSync("docker", args, { stdio: ["ignore", "pipe", "pipe"] }).toString();
}

async function freePort(start = 55440, end = 55540): Promise<number> {
  for (let port = start; port < end; port += 1) {
    const available = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => server.close(() => resolve(true)));
      server.listen(port, "127.0.0.1");
    });
    if (available) return port;
  }
  throw new Error("no free port found for the test database");
}

async function waitUntilReady(): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      docker(["exec", CONTAINER, "pg_isready", "-U", "postgres", "-h", "127.0.0.1"]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error("test postgres container did not become ready");
}

export default async function globalSetup(project: {
  provide?: (key: string, value: unknown) => void;
}): Promise<() => Promise<void>> {
  const port = await freePort();
  project.provide?.("testDbPort", port);

  try {
    execFileSync("docker", ["rm", "-f", CONTAINER], { stdio: "ignore" });
  } catch {
    // container not present
  }
  execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--name",
      CONTAINER,
      "-p",
      `127.0.0.1:${port}:5432`,
      "-e",
      "POSTGRES_PASSWORD=testpass",
      "postgres:18-alpine",
    ],
    { stdio: "ignore" },
  );
  await waitUntilReady();

  const migrationsDir = fileURLToPath(new URL("../../src/db/migrations/", import.meta.url));
  await runBootstrap({
    adminUrl: `postgres://postgres:testpass@127.0.0.1:${port}/postgres`,
    database: "lms_test",
    role: "app_user",
    rolePassword: "testpass",
    migrationsDir,
    createDatabase: true,
  });

  return async () => {
    if (process.env.KEEP_TEST_DB === "1") return;
    try {
      execFileSync("docker", ["rm", "-f", CONTAINER], { stdio: "ignore" });
    } catch {
      // ignore
    }
  };
}
