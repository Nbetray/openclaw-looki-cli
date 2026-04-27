import { execSync, spawnSync } from "node:child_process";

import {
  CHANNEL_ID,
  MIN_OPENCLAW_VERSION,
  PLUGIN_SPEC,
  compareVersions,
  parseVersion,
} from "@nbetray/openclaw-looki/shared";

import { error, log } from "./ui.js";
import { collectDiagnosticHints } from "./diagnose.js";
import type { Translator } from "./i18n.js";

export class ShellError extends Error {
  stderr: string;
  constructor(message: string, stderr: string) {
    super(message);
    this.name = "ShellError";
    this.stderr = stderr;
  }
}

export type RunOptions = { silent?: boolean };

export function run(cmd: string, args: string[], options: RunOptions = {}): string {
  const silent = options.silent ?? true;
  const stdio: "inherit" | ["pipe", "pipe", "pipe"] = silent ? ["pipe", "pipe", "pipe"] : "inherit";
  const result = spawnSync(cmd, args, { stdio });
  if (result.status !== 0) {
    const stderr = silent ? (result.stderr?.toString() ?? "") : "";
    throw new ShellError(
      `Command failed with exit code ${result.status}: ${cmd} ${args.join(" ")}`,
      stderr,
    );
  }
  return silent ? (result.stdout?.toString() ?? "").trim() : "";
}

export function which(bin: string): string | null {
  const locator = process.platform === "win32" ? "where" : "which";
  try {
    return execSync(`${locator} ${bin}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

export function getOpenclawVersion(): string | null {
  try {
    const raw = run("openclaw", ["--version"]);
    const parsed = parseVersion(raw);
    if (parsed) return parsed.join(".");
    const match = raw.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function ensureOpenclawInstalled(t: Translator): void {
  if (!which("openclaw")) {
    error(t("openclawMissing"));
    console.log("  npm install -g openclaw");
    console.log(t("docsHint"));
    process.exit(1);
  }
  log(t("openclawFound"));
}

export function ensureHostVersion(t: Translator): string {
  const version = getOpenclawVersion();
  if (!version) {
    error(t("versionMissing"));
    process.exit(1);
  }

  if (compareVersions(version, MIN_OPENCLAW_VERSION) < 0) {
    error(t("versionTooLow", { version }));
    process.exit(1);
  }

  log(t("versionDetected", { version }));
  return version;
}

export type InstallPluginOptions = {
  onProgress?: (stage: "install-start" | "install-done" | "update-start" | "update-done") => void;
};

export function installPlugin(t: Translator, opts: InstallPluginOptions = {}): void {
  opts.onProgress?.("install-start");
  try {
    const out = run("openclaw", ["plugins", "install", PLUGIN_SPEC]);
    opts.onProgress?.("install-done");
    if (out) log(out);
  } catch (installErr) {
    if (installErr instanceof ShellError && installErr.stderr.includes("already exists")) {
      opts.onProgress?.("update-start");
      try {
        const out = run("openclaw", ["plugins", "update", CHANNEL_ID]);
        opts.onProgress?.("update-done");
        log(t("installUpdated"));
        if (out) log(out);
        return;
      } catch (updateErr) {
        error(t("updateFailedManual"));
        if (updateErr instanceof ShellError && updateErr.stderr) {
          console.error(updateErr.stderr);
        }
        for (const hint of collectDiagnosticHints(updateErr as ShellError, t)) {
          log(hint);
        }
        console.log(`  openclaw plugins update "${CHANNEL_ID}"`);
        process.exit(1);
      }
    }

    error(t("installFailedManual"));
    if (installErr instanceof ShellError && installErr.stderr) {
      console.error(installErr.stderr);
    }
    for (const hint of collectDiagnosticHints(installErr as ShellError, t)) {
      log(hint);
    }
    console.log(`  openclaw plugins install "${PLUGIN_SPEC}"`);
    process.exit(1);
  }
}

export function restartGateway(t: Translator): void {
  try {
    run("openclaw", ["gateway", "restart"], { silent: false });
    log(t("restartDone"));
  } catch (restartErr) {
    error(t("restartFailedManual"));
    for (const hint of collectDiagnosticHints(restartErr as ShellError, t)) {
      log(hint);
    }
    console.log("  openclaw gateway restart");
  }
}
