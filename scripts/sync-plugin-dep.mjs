#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const PACKAGE_JSON_URL = new URL("../package.json", import.meta.url);
const DEP_NAME = "@nbetray/openclaw-looki";

async function main() {
  const pkg = JSON.parse(await readFile(PACKAGE_JSON_URL, "utf8"));
  if (!pkg.version || typeof pkg.version !== "string") {
    throw new Error("package.json version is missing or invalid");
  }

  pkg.dependencies = pkg.dependencies ?? {};
  const current = pkg.dependencies[DEP_NAME];
  if (current === pkg.version) {
    console.log(`${DEP_NAME} already pinned to ${pkg.version}`);
    return;
  }

  pkg.dependencies[DEP_NAME] = pkg.version;
  await writeFile(PACKAGE_JSON_URL, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`synced ${DEP_NAME} version -> ${pkg.version}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
