import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const originalUrl = process.env.DATABASE_URL;
if (!originalUrl) throw new Error("Configure DATABASE_URL no .env antes dos testes.");
const adminUrl = new URL(originalUrl);
if (!new Set(["/greencode", "/greencode_av2_test"]).has(adminUrl.pathname)) {
  throw new Error("Os testes esperam DATABASE_URL apontando para o banco greencode.");
}
adminUrl.pathname = "/greencode";
const testUrl = new URL(originalUrl);
testUrl.pathname = "/greencode_av2_test";
const testEnv = { ...process.env, DATABASE_URL: testUrl.toString() };
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });

function run(args, env = testEnv) {
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  const found = await admin.$queryRaw`SELECT 1 FROM pg_database WHERE datname = 'greencode_av2_test'`;
  if (found.length === 0) {
    run([resolve("node_modules/prisma/build/index.js"), "db", "execute", "--url", adminUrl.toString(), "--file", "prisma/create-test-database.sql"], process.env);
  }
} finally {
  await admin.$disconnect();
}

run([resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], testEnv);
run([resolve("dist-seed/prisma/seed.js")], testEnv);
const testFiles = readdirSync(resolve("dist-test/test"), { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith(".test.js"))
  .map(entry => resolve("dist-test/test", entry.name));
run(["--test", ...testFiles], testEnv);
